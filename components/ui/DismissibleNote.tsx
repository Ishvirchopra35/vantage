'use client';

// A one-off explanation the user should read once and then stop seeing.
//
// The format note above the resume preview is the case this exists for: useful
// the first time, noise on the fortieth download. Dismissal is remembered in
// localStorage under `id`, so it survives reloads without needing an account
// setting for something this small.

import { useCallback, useSyncExternalStore } from 'react';

interface DismissibleNoteProps {
  /** Stable key for this note. Changing it shows the note again. */
  id: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const PREFIX = 'vantage-note-dismissed:';

// localStorage is an external store, so it is read through
// useSyncExternalStore rather than copied into state inside an effect. That
// keeps the server and client renders consistent and means dismissing updates
// every note with the same id at once.
//
// The listener set exists because localStorage does not notify the tab that
// wrote to it - the `storage` event only fires in *other* tabs.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(`${PREFIX}${id}`) === '1';
  } catch {
    // Storage blocked: show the note. Being unable to remember a dismissal is
    // not a reason to hide an explanation.
    return false;
  }
}

function dismiss(id: string): void {
  try {
    localStorage.setItem(`${PREFIX}${id}`, '1');
  } catch {
    // Nothing to persist to; the note stays until the page reloads.
  }
  for (const listener of listeners) listener();
}

/**
 * Whether this note has been dismissed. Exported so a prompt with its own
 * layout can share one dismissal with the plain note - dismissing it in one
 * place has to mean dismissing it everywhere, or the user has to do it again
 * on the next page and rightly stops believing the button.
 */
export function useNoteDismissed(id: string): boolean {
  const subscribeToId = useCallback((onChange: () => void) => subscribe(onChange), []);
  return useSyncExternalStore(
    subscribeToId,
    () => isDismissed(id),
    // Rendered as dismissed on the server. Showing it and then removing it
    // would flash the note at someone who dismissed it months ago, which is
    // worse than it appearing a moment late.
    () => true
  );
}

export { dismiss as dismissNote };

export default function DismissibleNote({
  id,
  children,
  style,
}: DismissibleNoteProps): React.ReactElement | null {
  const dismissed = useNoteDismissed(id);

  if (dismissed) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '10px 12px 10px 14px',
        background: 'var(--card-raised)',
        borderRadius: '10px',
        fontSize: '12px',
        color: 'var(--muted)',
        lineHeight: 1.6,
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <button
        type="button"
        onClick={() => dismiss(id)}
        title="Dismiss"
        aria-label="Dismiss this note"
        className="note-dismiss"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </div>
  );
}
