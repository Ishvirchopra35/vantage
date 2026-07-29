// Checks that a transcription actually contains the resume.
//
// The model is asked to copy every line and usually does, but on a long resume
// it sometimes drops a bullet or two - and a missing bullet is invisible. The
// document parses, renders and downloads perfectly; it just says less than the
// candidate wrote, which is the worst kind of failure because nothing looks
// wrong.
//
// The source text is right there, so this is checkable rather than something
// to hope for. Every substantial line of the original is looked for in the
// parsed document, and a transcription that lost too much is rejected and
// retried with the missing lines quoted back.

import { normaliseSection, type ResumeDoc } from './schema';

/** Comparable form of a line: lowercase, alphanumerics only. */
function fingerprint(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * How much of a line has to be present for it to count as transcribed.
 *
 * Not all of it, because a bullet legitimately loses its glyph and its
 * surrounding whitespace on the way in. Comparing the opening of the line is
 * enough to tell "this bullet is here" from "this bullet is gone", and is
 * unaffected by a trailing character the extractor mangled.
 */
const PREFIX = 24;

/**
 * Lines too short to check. A one-word line carries no evidence either way and
 * appears inside other lines by chance, so counting it would only add noise.
 *
 * This was 30, which turned out to exempt exactly the lines that were going
 * missing: "Languages: Python, C, Java, SQL" fingerprints to 26 characters and
 * a coursework line to not much more, so a dropped skills or education line was
 * not merely tolerated, it was never looked at. Low enough now to cover a real
 * line, high enough that a heading or a date is still ignored.
 */
const MIN_LINE = 14;

/** Every line of the source worth accounting for. */
function sourceLines(sourceText: string): string[] {
  const seen = new Set<string>();
  return sourceText
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*•‣◦⁃]+/, '').trim())
    .filter((line) => {
      const key = fingerprint(line);
      if (key.length < MIN_LINE || seen.has(key)) return false;
      // A line the resume genuinely prints twice is present if it appears once,
      // so counting it twice would only distort the coverage figure.
      seen.add(key);
      return true;
    });
}

/** Everything the parsed document says. */
function documentText(doc: ResumeDoc): string {
  return [
    doc.name,
    doc.contact,
    ...doc.sections
      .map(normaliseSection)
      .flatMap((section) => [section.heading, ...section.blocks.map((block) => block.text)]),
  ].join('\n');
}

export interface CompletenessReport {
  /** Source lines that do not appear in the document, in order. */
  missing: string[];
  /** Share of checkable source lines that were transcribed, 0 to 1. */
  coverage: number;
}

/** Which lines of `sourceText` did not survive into `doc`. */
export function checkCompleteness(doc: ResumeDoc, sourceText: string): CompletenessReport {
  const lines = sourceLines(sourceText);
  if (lines.length === 0) return { missing: [], coverage: 1 };

  const haystack = fingerprint(documentText(doc));
  const missing = lines.filter((line) => !haystack.includes(fingerprint(line).slice(0, PREFIX)));

  return { missing, coverage: (lines.length - missing.length) / lines.length };
}

/**
 * How complete a transcription has to be to be accepted.
 *
 * A missing line is always worth another attempt, so this is 1: anything short
 * of every line triggers a retry with the missing ones quoted back. The
 * previous 0.9 was a rule that a long resume could lose three lines and pass,
 * which is exactly what happened.
 *
 * It is a bar for accepting an attempt, not for refusing the resume. When no
 * attempt reaches it the fullest one is still returned - a resume missing one
 * line beats no resume at all - so setting it here costs at most an extra call
 * and cannot fail an upload.
 */
export const MIN_COVERAGE = 1;
