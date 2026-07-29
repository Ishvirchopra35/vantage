'use client';

// Tells someone with a PDF resume that uploading the Word version would keep
// their own formatting.
//
// Shown only to people it applies to. A user who already uploaded a .docx gets
// their exact document back on every download, so asking them to upload one
// would be advice they have already taken - and a prompt that does not apply is
// the kind of thing people learn to ignore, which costs the prompts that do.
//
// Two shapes, one dismissal. The card is for the dashboard, where this is worth
// interrupting for; the note is for the download areas, where the user is
// already mid-task and only needs the reminder in passing. Dismissing either
// dismisses both, because it is one piece of advice.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isDocxFile } from '@/lib/docx/fileType';
import DismissibleNote, { dismissNote, useNoteDismissed } from '@/components/ui/DismissibleNote';

const NOTE_ID = 'upload-word-resume';

interface WordResumeNudgeProps {
  /** 'card' is the prominent dashboard form; 'note' is the inline reminder. */
  variant?: 'card' | 'note';
  style?: React.CSSProperties;
  /**
   * Answered on the server where the caller already knows. Skips the client
   * query, and skips the moment of nothing before it returns.
   */
  needsWord?: boolean;
}

export default function WordResumeNudge({
  variant = 'note',
  style,
  needsWord,
}: WordResumeNudgeProps): React.ReactElement | null {
  // Three states, and the difference matters: not yet known (render nothing),
  // known and already Word (render nothing), known and not Word (show it).
  const [applies, setApplies] = useState(needsWord ?? false);
  const dismissed = useNoteDismissed(NOTE_ID);

  useEffect(() => {
    if (needsWord !== undefined) return;
    let cancelled = false;

    async function check() {
      try {
        const { data } = await createClient()
          .from('resumes')
          .select('file_name, file_url')
          .eq('is_base', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (cancelled || !data) return;

        // No resume at all is not this prompt's problem - the page will
        // already be telling them to upload one.
        const name = data.file_name ?? data.file_url ?? '';
        if (name) setApplies(!isDocxFile(name, ''));
      } catch {
        // Never guess. If the resume cannot be read, say nothing rather than
        // tell a Word user to upload a Word file.
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [needsWord]);

  if (!applies) return null;

  if (variant === 'note') {
    return (
      <DismissibleNote id={NOTE_ID} style={style}>
        <strong style={{ color: 'var(--text)', fontWeight: 600 }}>
          Want downloads to match your resume exactly?
        </strong>{' '}
        Your resume is a PDF, so downloads use a standard layout. Upload the Word (.docx) version
        on your{' '}
        <Link href="/profile" style={{ color: 'var(--text)', textDecoration: 'underline' }}>
          profile
        </Link>{' '}
        and every download becomes your own document with the new wording in it.
      </DismissibleNote>
    );
  }

  if (dismissed) return null;

  // Built from the shared dark-glass material rather than hand-rolled, so it
  // sits on the dashboard as a card among cards instead of a panel that
  // obviously came from somewhere else.
  return (
    <div className="ds-card word-nudge" style={style}>
      <span className="ds-icon-tile word-nudge-icon" aria-hidden="true">
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11.5 2.5H5.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V7Z" />
          <path d="M11.5 2.5V7H16" />
          <path d="M7.5 10.5 9 14l1-2.5 1 2.5 1.5-3.5" />
        </svg>
      </span>

      <div className="word-nudge-body">
        <div className="ds-section-label">Formatting</div>
        <div className="word-nudge-title">Upload the Word version of your resume</div>
        <p className="word-nudge-text">
          Your resume is a PDF, so tailored downloads come back in a standard layout instead of
          yours. Upload the .docx and every download becomes your own document with the new wording
          in it, keeping your fonts, spacing and layout exactly as you wrote them.
        </p>
      </div>

      {/* A sibling of the body, not a child, so it can sit at the right of a
          wide card instead of leaving half of it empty. */}
      <div className="word-nudge-actions">
        <Link href="/profile" className="ds-btn-primary">
          Upload it on your profile
        </Link>
        <button type="button" onClick={() => dismissNote(NOTE_ID)} className="ds-btn">
          Not now
        </button>
      </div>
    </div>
  );
}
