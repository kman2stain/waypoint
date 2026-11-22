// Data schema for Waypoint. See docs/PROPOSAL.md for the reasoning.
// Everything lives in IndexedDB on the device; the backup file uses the same shapes.

export const SCHEMA_VERSION = 1;

export type ID = string;
/** Calendar date without time, local: YYYY-MM-DD */
export type ISODate = string;
/** Full timestamp: new Date().toISOString() */
export type ISODateTime = string;

export interface Base {
  id: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Meta {
  id: 'meta';
  schemaVersion: number;
  seededAt: ISODateTime;
  /** Day 1 of the plan. Unset until the user chooses it. */
  startDate?: ISODate;
  lastExportAt?: ISODateTime;
}

export interface Phase extends Base {
  order: number;
  title: string;
  /** Months after startDate where this phase begins / ends. */
  monthsFrom: number;
  monthsTo: number;
}

export const MILESTONE_STATUSES = ['not_started', 'in_progress', 'done'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export const STATUS_LABELS: Record<MilestoneStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
};

export interface Evidence {
  id: ID;
  text: string;
  date?: ISODate;
  confirmedBy?: string;
}

export interface Milestone extends Base {
  phaseId: ID;
  order: number;
  title: string;
  kind: 'task' | 'gate';
  /** For decision gates: month after startDate when the gate falls. */
  gateMonth?: number;
  status: MilestoneStatus;
  targetDate?: ISODate;
  notes: string;
  evidence: Evidence[];
  projectId?: ID;
}

export interface Project extends Base {
  name: string;
  archived: boolean;
}

export interface Note extends Base {
  text: string;
  tags: string[];
  milestoneId?: ID;
  projectId?: ID;
}

export interface Win extends Base {
  title: string;
  /** Only ever what the user typed. Never computed or estimated. */
  before?: number;
  after?: number;
  unit?: string;
  date?: ISODate;
  /** Source / confirmed by. */
  source?: string;
  context?: string;
  milestoneId?: ID;
  projectId?: ID;
}

export type RepeatFreq = 'none' | 'daily' | 'weekly' | 'monthly';
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export interface Reminder extends Base {
  title: string;
  kind: 'weekly_review' | 'study_block' | 'backup' | 'one_off';
  /** Local date-time, no zone: YYYY-MM-DDTHH:mm */
  start: string;
  durationMin: number;
  repeat: { freq: RepeatFreq; interval: number; byDay?: Weekday[]; until?: ISODate };
  alertMinutesBefore: number[];
  notes?: string;
  active: boolean;
  /** When this reminder was last handed to the iPhone Calendar (.ics). */
  calendarAddedAt?: ISODateTime;
}

export const REMINDER_KINDS = ['weekly_review', 'study_block', 'backup', 'one_off'] as const;
export const REMINDER_KIND_LABELS: Record<Reminder['kind'], string> = {
  weekly_review: 'Weekly review',
  study_block: 'Study block',
  backup: 'Backup reminder',
  one_off: 'One-off task',
};
