'use client';

// The little add / remove affordances used throughout the preview.
//
// Kept deliberately quiet: a resume review screen should read as a document,
// not a spreadsheet. The delete button only becomes visible when the row is
// hovered or focused, so a user reading their resume sees a resume, and a user
// editing it sees the controls exactly where they reach for them.

interface DeleteButtonProps {
  onClick: () => void;
  label: string;
}

export function DeleteButton({ onClick, label }: DeleteButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="resume-row-delete"
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <line x1="3" y1="3" x2="13" y2="13" />
        <line x1="13" y1="3" x2="3" y2="13" />
      </svg>
    </button>
  );
}

interface AddButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export function AddButton({ onClick, children }: AddButtonProps): React.ReactElement {
  return (
    <button type="button" onClick={onClick} className="resume-row-add">
      + {children}
    </button>
  );
}
