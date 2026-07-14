// Pure helpers behind the Auto-apply page listing. No I/O, fully testable.
import { hasRealJobTitle } from '@/lib/jobFilters';

/**
 * A tracked application row as listed on the Auto-apply page.
 *
 * `job_id` may be null for manually-logged tracker entries; `id` is always
 * present and is used as the stable navigation key.
 */
export interface TrackedApplicationRow {
  id: string;
  job_id: string | null;
  company: string;
  role: string;
  created_at: string;
}

/**
 * Build the Auto-apply listing from tracked application rows.
 *
 * Returns every row whose `role` is a real job title, preserving input order.
 * Manual rows (null `job_id`) are kept, and rows that share a `job_id` are NOT
 * deduped/collapsed — each application appears as its own entry.
 */
export function toAutoApplyList(rows: TrackedApplicationRow[]): TrackedApplicationRow[] {
  return rows.filter((row) => hasRealJobTitle(row.role));
}

/**
 * Navigation target for a listed application. Keyed on the always-present `id`
 * so manual rows (null `job_id`) still produce a valid href.
 */
export function autoApplyHref(row: TrackedApplicationRow): string {
  return `/apply/${row.id}`;
}
