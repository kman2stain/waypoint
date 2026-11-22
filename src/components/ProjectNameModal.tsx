import { useState } from 'preact/hooks';
import type { Project } from '../db/schema';
import { findProjectByName } from '../lib/projects';
import { Modal } from './Modal';

interface Props {
  /** The project being renamed. Absent when adding one. */
  project?: Project;
  projects: Project[];
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export function ProjectNameModal(props: Props & { open: boolean }) {
  return (
    <Modal open={props.open} title={props.project ? 'Rename project' : 'New project'} onClose={props.onClose}>
      <NameForm {...props} />
    </Modal>
  );
}

// Modal mounts its children only while open, so the field starts fresh each time.
function NameForm(props: Props) {
  const [name, setName] = useState(props.project?.name ?? '');
  const [busy, setBusy] = useState(false);
  const same = findProjectByName(name, props.projects);
  const taken = !!same && same.id !== props.project?.id;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || taken || !name.trim()) return;
        setBusy(true);
        try {
          await props.onSave(name.trim());
        } finally {
          setBusy(false);
        }
      }}
    >
      <label class="field">
        <span class="field-label">Project name</span>
        <input
          type="text"
          required
          autoComplete="off"
          value={name}
          aria-invalid={taken}
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </label>
      {taken && (
        <p class="error-text small" role="alert" style={{ marginTop: '0.3rem' }}>
          You already have a project with this name.
        </p>
      )}
      <div class="modal-actions">
        <button type="button" class="btn" onClick={props.onClose}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" disabled={busy || taken || !name.trim()}>
          {props.project ? 'Save' : 'Add project'}
        </button>
      </div>
    </form>
  );
}
