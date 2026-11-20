import { PLACEHOLDER_AFTER, PLACEHOLDER_BEFORE } from '../lib/cvBullet';

const SPLIT = new RegExp(`(${[PLACEHOLDER_BEFORE, PLACEHOLDER_AFTER].map((p) => p.replace(/[[\]]/g, '\\$&')).join('|')})`);

/** Renders a CV bullet with its placeholders highlighted. */
export function BulletText(props: { text: string }) {
  return (
    <>
      {props.text.split(SPLIT).map((part, i) =>
        part === PLACEHOLDER_BEFORE || part === PLACEHOLDER_AFTER ? (
          <mark key={i} class="placeholder">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
