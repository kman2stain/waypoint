// Tiny hand-written validator used for backups (and later AI proposals and sync).
// Collects readable errors like `data.milestones[3].status: must be one of ...`.
import { isISODate } from './dates';

export type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isStr = (v: unknown): v is string => typeof v === 'string';
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

interface Opt {
  optional?: boolean;
}

export class Checker {
  readonly errors: string[] = [];

  constructor(private readonly max = 30) {}

  get ok(): boolean {
    return this.errors.length === 0;
  }

  fail(path: string, msg: string): void {
    if (this.errors.length < this.max) this.errors.push(`${path}: ${msg}`);
  }

  private missing(o: Obj, k: string, path: string, opt: Opt): boolean {
    if (o[k] !== undefined) return false;
    if (!opt.optional) this.fail(`${path}.${k}`, 'is missing');
    return true;
  }

  str(o: Obj, k: string, path: string, opt: Opt & { nonEmpty?: boolean; max?: number } = {}): void {
    if (this.missing(o, k, path, opt)) return;
    const v = o[k];
    if (!isStr(v)) return this.fail(`${path}.${k}`, 'must be text');
    if (opt.nonEmpty && !v.trim()) this.fail(`${path}.${k}`, 'must not be empty');
    if (opt.max !== undefined && v.length > opt.max) this.fail(`${path}.${k}`, `is longer than ${opt.max} characters`);
  }

  num(o: Obj, k: string, path: string, opt: Opt & { int?: boolean; min?: number } = {}): void {
    if (this.missing(o, k, path, opt)) return;
    const v = o[k];
    if (!isNum(v)) return this.fail(`${path}.${k}`, 'must be a number');
    if (opt.int && !Number.isInteger(v)) this.fail(`${path}.${k}`, 'must be a whole number');
    if (opt.min !== undefined && v < opt.min) this.fail(`${path}.${k}`, `must be at least ${opt.min}`);
  }

  bool(o: Obj, k: string, path: string, opt: Opt = {}): void {
    if (this.missing(o, k, path, opt)) return;
    if (typeof o[k] !== 'boolean') this.fail(`${path}.${k}`, 'must be true or false');
  }

  date(o: Obj, k: string, path: string, opt: Opt = {}): void {
    if (this.missing(o, k, path, opt)) return;
    if (!isISODate(o[k])) this.fail(`${path}.${k}`, 'must be a date like 2026-01-31');
  }

  dateTime(o: Obj, k: string, path: string, opt: Opt = {}): void {
    if (this.missing(o, k, path, opt)) return;
    const v = o[k];
    if (!isStr(v) || Number.isNaN(Date.parse(v))) this.fail(`${path}.${k}`, 'must be a timestamp');
  }

  oneOf(o: Obj, k: string, path: string, values: readonly string[], opt: Opt = {}): void {
    if (this.missing(o, k, path, opt)) return;
    if (!values.includes(o[k] as string)) this.fail(`${path}.${k}`, `must be one of: ${values.join(', ')}`);
  }

  strArray(o: Obj, k: string, path: string, opt: Opt = {}): void {
    if (this.missing(o, k, path, opt)) return;
    const v = o[k];
    if (!Array.isArray(v) || !v.every(isStr)) this.fail(`${path}.${k}`, 'must be a list of text');
  }
}
