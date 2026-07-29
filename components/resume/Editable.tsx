'use client';

// A single click-to-edit field in the resume preview.
//
// contentEditable on a <span> rather than an <input>: it reflows like real
// document text, so the preview reads like a resume instead of a form.
//
// The field shows two different strings depending on whether it has focus.
// Reading, it shows the text as the finished resume will read it, with an
// address hidden behind its label - "LinkedIn", not "LinkedIn
// (linkedin.com/in/jane)". Editing, it shows the full stored text, because the
// address is the only place the link is recorded and a user who wants to
// correct it has to be able to see it.
//
// React never renders the text: the DOM is written imperatively in an effect
// instead. Letting React own the children of a contentEditable node means it
// tries to reconcile the node while the user is typing in it, which collapses
// the caret to position zero. Writing it ourselves - and only when the value
// or the focus state actually changes - keeps typing untouched.

import { useEffect, useRef, useState } from 'react';
import { collapseLinkText } from '@/lib/docx/links';

interface EditableProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  /** Focus this field as soon as it mounts - set on a freshly added row. */
  autoFocus?: boolean;
}

export default function Editable({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
}: EditableProps): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const next = editing ? value : collapseLinkText(value);
    // Guarded so an unrelated re-render never rewrites the node mid-edit.
    if (element.innerText !== next) element.innerText = next;
  }, [value, editing]);

  // Without this, clicking "+ entry" leaves focus on the button. Typing then
  // does nothing visible - except that every SPACE re-activates the focused
  // button, so a user who clicks add and starts typing silently creates one
  // new empty row per space in their sentence.
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      aria-label={placeholder}
      title={value !== collapseLinkText(value) ? value : undefined}
      onFocus={() => setEditing(true)}
      // Committing on blur rather than on every keystroke keeps the caret
      // stable, and means the collapsed form is only restored once the user
      // has finished with the field.
      onBlur={() => {
        const next = ref.current?.innerText ?? '';
        setEditing(false);
        if (next !== value) onChange(next);
      }}
      onKeyDown={(e) => {
        // Enter would insert a <div> into the node and desync innerText from
        // what the user sees. Blur instead - multi-line fields are rare here.
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
      data-placeholder={placeholder}
      className={`resume-editable ${className ?? ''}`}
    />
  );
}
