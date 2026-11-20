import type { MilestoneStatus } from '../db/schema';

/** Shape differs per status (not just colour), so it reads without colour vision. */
export function StatusIcon(props: { status: MilestoneStatus }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', 'aria-hidden': true, class: `status-icon status-${props.status}` };
  if (props.status === 'done') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="var(--surface)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    );
  }
  if (props.status === 'in_progress') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>
  );
}

export const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" class="chevron">
    <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
