import { useEffect, useRef } from 'preact/hooks';
import { setLeaveGuard } from '../router';
import { confirmAction } from './ConfirmDialog';

/**
 * While `dirty` is true, leaving the screen (tab bar, back, update Reload)
 * asks "Discard changes?". Set the returned ref's `.current = true` right
 * before navigating away after a successful save.
 */
export function useLeaveGuard(dirty: boolean, what: string) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const bypass = useRef(false);

  useEffect(
    () =>
      setLeaveGuard(async () => {
        if (!dirtyRef.current || bypass.current) return true;
        return confirmAction({
          title: 'Discard changes?',
          body: `Your edits to this ${what} haven't been saved.`,
          confirmLabel: 'Discard',
          cancelLabel: 'Keep editing',
          danger: true,
        });
      }),
    [what],
  );

  return bypass;
}
