import type { ComponentChildren } from 'preact';
import { navigate } from '../router';

/** An in-app link that respects the "Discard changes?" guard. */
export function Link(props: { href: string; class?: string; children: ComponentChildren }) {
  return (
    <a
      href={props.href}
      class={props.class}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate(props.href);
      }}
    >
      {props.children}
    </a>
  );
}
