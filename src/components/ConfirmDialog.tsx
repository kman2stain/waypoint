import { render } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useDialogClose } from './Modal';

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}

function Confirm(props: ConfirmOptions & { onDone: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const settled = useRef(false);

  // Report the choice immediately on tap. Don't wait for the dialog's 'close'
  // event: browsers may delay it (e.g. until the next repaint). The close
  // listener only covers Esc, which counts as Cancel.
  const finish = (ok: boolean) => {
    if (settled.current) return;
    settled.current = true;
    if (ref.current?.open) ref.current.close();
    props.onDone(ok);
  };
  useDialogClose(ref, () => finish(false));

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      class="modal"
      role="alertdialog"
      aria-labelledby="confirm-title"
      aria-describedby={props.body ? 'confirm-body' : undefined}
    >
      <div class="modal-body">
        <h2 id="confirm-title">{props.title}</h2>
        {props.body && (
          <p id="confirm-body" class="muted">
            {props.body}
          </p>
        )}
        <div class="modal-actions">
          <button type="button" class="btn" onClick={() => finish(false)} autoFocus>
            {props.cancelLabel ?? 'Cancel'}
          </button>
          <button type="button" class={props.danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => finish(true)}>
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Ask the user to confirm. Resolves true only on an explicit tap of the confirm button. */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(
      <Confirm
        {...opts}
        onDone={(ok) => {
          render(null, host);
          host.remove();
          resolve(ok);
        }}
      />,
      host,
    );
  });
}
