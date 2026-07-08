export interface TrackableJob {
  jobId: string | null;
  title: string | null;
}

/** A title is "real" when it is a non-empty, non-whitespace, non-placeholder string. */
export function hasRealJobTitle(title: string | null | undefined): boolean {
  if (title == null) return false;
  const t = title.trim();
  if (t.length === 0) return false;
  const lower = t.toLowerCase();
  return lower !== 'untitled job' && lower !== 'untitled';
}

/** Keep only first occurrence per non-null jobId, preserving input order. */
export function dedupeByJobId<T extends { jobId: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (row.jobId == null) continue;
    if (seen.has(row.jobId)) continue;
    seen.add(row.jobId);
    out.push(row);
  }
  return out;
}

/**
 * Applications-backed filter: keep only rows whose jobId is present in the
 * set of tracked application job ids AND whose title is real.
 */
export function filterTrackedJobs<T extends TrackableJob>(
  rows: T[],
  trackedJobIds: Set<string>,
): T[] {
  return rows.filter(
    (r) => r.jobId != null && trackedJobIds.has(r.jobId) && hasRealJobTitle(r.title),
  );
}
