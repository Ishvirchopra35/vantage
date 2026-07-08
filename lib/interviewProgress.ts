/**
 * Interview session practice-progress classification (Requirement 8.3).
 */
export type SessionProgress = 'not_started' | 'in_progress' | 'complete';

/**
 * Classify an interview session's practice progress from the number of
 * assessed questions relative to the total number of questions.
 *
 * - `'not_started'` when there are no questions (`total === 0`) or none have
 *   been assessed yet (`assessed === 0`).
 * - `'complete'` when there is at least one question and every question has
 *   been assessed (`total > 0` and `assessed >= total`).
 * - `'in_progress'` otherwise.
 */
export function sessionProgress(assessed: number, total: number): SessionProgress {
  if (total === 0 || assessed === 0) return 'not_started';
  if (assessed >= total) return 'complete';
  return 'in_progress';
}
