// Hand a file to the iPhone share sheet (where "Save to Files" lives), falling
// back to a normal download where sharing files isn't supported.
// Must be called directly from a tap: Safari only allows sharing during a user gesture.

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

export function shareFileCandidate(name: string, text: string, type: string): File | null {
  if (typeof navigator.canShare !== 'function') return null;
  // Some browsers only allow sharing certain types; try the real type, then plain text.
  for (const t of [type, 'text/plain']) {
    const file = new File([text], name, { type: t });
    try {
      if (navigator.canShare({ files: [file] })) return file;
    } catch {
      /* try the next type */
    }
  }
  return null;
}

export async function shareOrDownload(file: File | null, name: string, text: string, type: string): Promise<ShareOutcome> {
  if (file) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Any other failure: fall through to a download.
    }
  }
  download(name, text, type);
  return 'downloaded';
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
