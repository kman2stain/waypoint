import type { ComponentChildren } from 'preact';

export function EmptyState(props: { title: string; children?: ComponentChildren }) {
  return (
    <div class="card empty">
      <h2>{props.title}</h2>
      {props.children && <div class="muted">{props.children}</div>}
    </div>
  );
}
