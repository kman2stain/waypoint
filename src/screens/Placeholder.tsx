import { EmptyState } from '../components/EmptyState';

const COPY = {
  notes: ['Notes', 'One-tap capture with tags, links to milestones and search. Arrives in milestone M3.'],
  reminders: [
    'Reminders',
    'Recurring reminders (weekly review, study blocks, backups) exported to your iPhone Calendar. Arrives in milestone M4.',
  ],
  wins: ['Wins', 'Before / after results with sources, and "Copy as CV bullet". Arrives in milestone M5.'],
} as const;

export function Placeholder(props: { which: string }) {
  const entry = COPY[props.which as keyof typeof COPY];
  if (!entry) return null;
  const [title, body] = entry;
  return <EmptyState title={`${title} is coming`}>{body}</EmptyState>;
}
