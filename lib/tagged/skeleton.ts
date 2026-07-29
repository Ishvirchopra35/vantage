// Structural fingerprinting for tagged resumes.
//
// This is the mechanical guarantee behind the product's core claim: the AI
// rewrites the *text* of a resume but can never scramble its *structure*.
// We fingerprint the tag sequence before an AI pass and again after, and
// refuse the result if they differ. No trust in the prompt required.

/**
 * The ordered sequence of open/close tags with every character of text
 * stripped out. Two documents with the same skeleton have identical
 * structure - same sections, same number of jobs, same number of bullets in
 * each job, same order - regardless of what the text says.
 */
export function tagSkeleton(xml: string): string[] {
  const tags: string[] = [];
  for (const match of xml.matchAll(/<(\/?)([a-zA-Z][\w-]*)\s*\/?>/g)) {
    tags.push(`${match[1]}${match[2]}`);
  }
  return tags;
}

/** Human-readable diff used in the error message when a check fails. */
function describeDrift(before: string[], after: string[]): string {
  const limit = Math.max(before.length, after.length);
  for (let i = 0; i < limit; i++) {
    if (before[i] !== after[i]) {
      return `at position ${i}: expected <${before[i] ?? 'end of document'}>, got <${after[i] ?? 'end of document'}>`;
    }
  }
  return 'lengths differ';
}

/**
 * Throws unless `after` has exactly the same tag skeleton as `before`.
 * Callers treat the throw as "retry the AI call", not as a fatal error.
 */
export function assertSameSkeleton(before: string, after: string): void {
  const a = tagSkeleton(before);
  const b = tagSkeleton(after);

  if (a.length !== b.length || a.some((tag, i) => tag !== b[i])) {
    throw new Error(
      `AI altered the resume structure (${a.length} tags in, ${b.length} out) - ${describeDrift(a, b)}`
    );
  }
}
