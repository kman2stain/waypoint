import { EmptyState } from '../components/EmptyState';

const COPY = {
  roadmap: ['Roadmap', 'Four phases with milestones, status, target dates and evidence. Arrives in milestone M1.'],
  notes: ['Notes', 'One-tap capture with tags, links to milestones and search. Arrives in milestone M3.'],
  wins: ['Wins', 'Before / after results with sources, and "Copy as CV bullet". Arrives in milestone M4.'],
  reminders: ['Reminders', 'Recurring reminders exported to your iPhone Calendar as .ics. Arrives in milestone M5.'],
} as const;

export function Placeholder(props: { which: keyof typeof COPY }) {
  const [title, body] = COPY[props.which];
  return <EmptyState title={`${title} is coming`}>{body}</EmptyState>;
}
