import { useState } from 'preact/hooks';
import { normalizeTag } from '../lib/tags';

export function TagInput(props: { id: string; tags: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState('');
  const candidate = normalizeTag(text);

  const add = () => {
    if (candidate && !props.tags.includes(candidate)) props.onChange([...props.tags, candidate]);
    setText('');
  };

  return (
    <div class="tag-input">
      {props.tags.length > 0 && (
        <ul class="chips" aria-label="Tags">
          {props.tags.map((t) => (
            <li key={t} class="chip">
              <span>#{t}</span>
              <button
                type="button"
                class="chip-remove"
                aria-label={`Remove tag ${t}`}
                onClick={() => props.onChange(props.tags.filter((x) => x !== t))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div class="inline">
        <input
          id={props.id}
          type="text"
          value={text}
          placeholder="Add a tag, e.g. sql"
          autoComplete="off"
          autoCapitalize="none"
          enterKeyHint="done"
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" class="btn" onClick={add} disabled={!candidate}>
          Add
        </button>
      </div>
    </div>
  );
}
