// Practice-progress classification for interview sessions, shared by the
// interview page cards and the session list.
export type SessionProgress = 'not_started' | 'in_progress' | 'complete';

/**
 * Classifies a session by how many of its questions have been assessed.
 * No questions or no assessments yet = not_started; every question
 * assessed = complete; anything in between = in_progress.
 */
export function sessionProgress(assessed: number, total: number): SessionProgress {
  if (total === 0 || assessed === 0) return 'not_started';
  if (assessed >= total) return 'complete';
  return 'in_progress';
}
