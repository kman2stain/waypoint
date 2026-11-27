// Minimal GitHub contents API client: read and write one file in one repo.
// The token is a fine-grained personal access token limited to that repo.

export interface SyncConfig {
  /** "owner/repo" */
  repo: string;
  /** Path of the data file inside the repo. */
  path: string;
  token: string;
}

export interface RemoteFile {
  text: string;
  sha: string;
}

export class SyncError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'not-found' | 'conflict' | 'network' | 'other' = 'other',
  ) {
    super(message);
  }
}

export const REPO_RE = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

function url(c: SyncConfig): string {
  const path = c.path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  return `https://api.github.com/repos/${c.repo}/contents/${path}`;
}

function headers(c: SyncConfig): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${c.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function decodeBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function call(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, { ...init, cache: 'no-store' });
  } catch {
    throw new SyncError("Couldn't reach GitHub. Check your connection.", 'network');
  }
}

function failure(res: Response, c: SyncConfig): SyncError {
  if (res.status === 401) return new SyncError('GitHub rejected the token. It may have expired: create a new one.', 'auth');
  if (res.status === 403)
    return new SyncError(`The token isn't allowed to change ${c.repo}. Give it "Contents: Read and write" on that repo.`, 'auth');
  if (res.status === 404) return new SyncError(`Can't find the repo ${c.repo}, or the token can't see it.`, 'not-found');
  if (res.status === 409 || res.status === 422) return new SyncError('The cloud copy changed during sync.', 'conflict');
  return new SyncError(`GitHub returned an error (${res.status}). Try again later.`);
}

/** The file, or null if it doesn't exist yet. */
export async function readFile(c: SyncConfig): Promise<RemoteFile | null> {
  const res = await call(url(c), { headers: headers(c) });
  if (res.status === 404) {
    // Tell "no file yet" apart from "no access to the repo".
    const repo = await call(`https://api.github.com/repos/${c.repo}`, { headers: headers(c) });
    if (repo.ok) return null;
    throw failure(repo, c);
  }
  if (!res.ok) throw failure(res, c);
  const body = (await res.json()) as { sha?: string; content?: string; encoding?: string; type?: string };
  if (body.type !== 'file' || !body.sha) throw new SyncError(`${c.path} in ${c.repo} isn't a file.`);
  // GitHub leaves content out (encoding "none") for files over 1 MB.
  if (body.encoding !== 'base64' || typeof body.content !== 'string') {
    throw new SyncError('The cloud file is too large to sync.');
  }
  return { text: decodeBase64(body.content), sha: body.sha };
}

/** Write the file. Pass the sha you read, so a newer cloud copy is never overwritten. Returns the new sha. */
export async function writeFile(c: SyncConfig, text: string, sha: string | null, message: string): Promise<string> {
  const body: Record<string, string> = { message, content: encodeBase64(text) };
  if (sha) body.sha = sha;
  const res = await call(url(c), {
    method: 'PUT',
    headers: { ...headers(c), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw failure(res, c);
  const out = (await res.json()) as { content?: { sha?: string } };
  if (!out.content?.sha) throw new SyncError('GitHub saved the file but sent an unexpected reply.');
  return out.content.sha;
}
