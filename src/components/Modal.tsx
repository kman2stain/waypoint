import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

/**
 * Attach a <dialog> 'close' listener directly. Preact 11 doesn't map the JSX
 * `onClose` prop to the lowercase DOM 'close' event, so it would never fire.
 */
export function useDialogClose(ref: { current: HTMLDialogElement | null }, onClose: () => void) {
  const handler = useRef(onClose);
  handler.current = onClose;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const fn = () => handler.current();
    d.addEventListener('close', fn);
    return () => d.removeEventListener('close', fn);
  }, [ref]);
}

/** Accessible modal built on <dialog> (focus trap, Esc to close, backdrop). */
export function Modal(props: { open: boolean; title: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDialogElement>(null);
  useDialogClose(ref, props.onClose);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (props.open && !d.open) d.showModal();
    if (!props.open && d.open) d.close();
  }, [props.open]);

  return (
    <dialog
      ref={ref}
      class="modal"
      aria-labelledby="modal-title"
      onClick={(e) => {
        // Tap on the backdrop closes.
        if (e.target === ref.current) props.onClose();
      }}
    >
      <div class="modal-body">
        <h2 id="modal-title">{props.title}</h2>
        {props.open && props.children}
      </div>
    </dialog>
  );
}
