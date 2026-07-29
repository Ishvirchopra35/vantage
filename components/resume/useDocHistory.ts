'use client';

// Undo/redo for the resume editor.
//
// A step is one committed change, not one keystroke: fields commit on blur, and
// the AI edit and the structural buttons each replace the document once. So the
// history reads the way a user would describe their own edits - "undo that
// bullet", "undo that instruction" - rather than unwinding letter by letter.
//
// Snapshots are whole documents. A resume is a few kilobytes of JSON and the
// stack is capped, so the memory is not worth the complexity of a diff.

import { useCallback, useMemo, useState } from 'react';
import type { ResumeDoc } from '@/lib/tagged/schema';

/**
 * How many steps back a user can go. Deep enough to cover a working session,
 * bounded so a long one cannot grow without limit.
 */
const LIMIT = 60;

export interface DocHistory {
  doc: ResumeDoc | null;
  /** Records a new state. `replace` overwrites the current step instead. */
  set: (next: ResumeDoc | null, options?: { replace?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Starts again from `doc`, discarding the history. */
  reset: (doc: ResumeDoc | null) => void;
}

interface Timeline {
  past: (ResumeDoc | null)[];
  present: ResumeDoc | null;
  future: (ResumeDoc | null)[];
}

export function useDocHistory(initial: ResumeDoc | null = null): DocHistory {
  const [timeline, setTimeline] = useState<Timeline>({
    past: [],
    present: initial,
    future: [],
  });

  const set = useCallback((next: ResumeDoc | null, options?: { replace?: boolean }) => {
    setTimeline((current) => {
      if (options?.replace) return { ...current, present: next };
      return {
        // Dropping the oldest step keeps the cap without a separate check.
        past: [...current.past, current.present].slice(-LIMIT),
        present: next,
        // A new edit after undoing abandons what was undone. Keeping it would
        // mean redo jumping to a document that never followed this one.
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setTimeline((current) => {
      if (current.past.length === 0) return current;
      return {
        past: current.past.slice(0, -1),
        present: current.past[current.past.length - 1],
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setTimeline((current) => {
      if (current.future.length === 0) return current;
      return {
        past: [...current.past, current.present],
        present: current.future[0],
        future: current.future.slice(1),
      };
    });
  }, []);

  const reset = useCallback((doc: ResumeDoc | null) => {
    setTimeline({ past: [], present: doc, future: [] });
  }, []);

  return useMemo(
    () => ({
      doc: timeline.present,
      set,
      undo,
      redo,
      canUndo: timeline.past.length > 0,
      canRedo: timeline.future.length > 0,
      reset,
    }),
    [timeline, set, undo, redo, reset]
  );
}
