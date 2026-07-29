// SERVER-SIDE ONLY - turns raw resume text into the tagged format.
//
// The model transcribes; it does not decide. Every section it emits is one the
// resume printed, under the heading the resume gave it, in the order they
// appeared. There is no fixed set of sections to route content into, so there
// is no wrong bucket to put something in - which is what the six repair passes
// this replaced spent their time detecting and undoing.
//
// Success is defined as "our own parser accepts it", not "the model said it was
// done": the tagged string round-trips through taggedToDoc, which rejects
// unknown tags and missing wrappers.

import * as Sentry from '@sentry/nextjs';
import { docToTagged, taggedToDoc } from '@/lib/tagged/serialize';
import { checkCompleteness, MIN_COVERAGE } from '@/lib/tagged/completeness';
import { docFromParagraphs } from '@/lib/tagged/fromParagraphs';
import { extractDocxParagraphs, extractResumeText } from '@/lib/docx/extractText';
import { docToPlainText } from '@/lib/tagged/plainText';
import type { ResumeDoc } from '@/lib/tagged/schema';
import { generateText } from '@/lib/ai';

// A long resume runs to several thousand output tokens once every field is
// wrapped in a tag. generateText defaults to 2000, which truncates mid-tag and
// fails the parse for a reason that looks nothing like the cause.
const MAX_TOKENS = 8000;

const SYSTEM_PROMPT = `You transcribe resumes into a strict tagged format. You are a transcriber, not a writer and not an editor.

A resume is a name, a contact line, and a list of sections. Each section is a heading and the LINES printed under it. You copy what is there. You never decide what a section should be called, which section something belongs to, or what order things go in - the resume already decided all of that and you are recording it.

Output EXACTLY this structure and nothing else - no markdown, no code fences, no commentary:

<resume>
  <name>Full name</name>
  <contact>The whole contact line, copied as one string</contact>
  <section>
    <heading>The section's heading, copied EXACTLY as the resume writes it</heading>
    <line>One line printed under that heading, copied whole</line>
    <bullet>One line printed with a bullet glyph, copied whole</bullet>
  </section>
</resume>

RULES

1. ONE TAG PER PRINTED LINE. This is the most important rule. If the resume prints a line, it becomes exactly one <line> or one <bullet>, containing that entire line and nothing from any other line.

2. <bullet> for a line printed with a bullet glyph. <line> for every other line - an employer, a job title, a degree, a date, a skills list, a summary sentence.

3. Copy wording VERBATIM. Do not rewrite, improve, shorten, summarise, reorder, split, merge or fix grammar. Not even a typo.

4. NEVER SPLIT ONE PRINTED LINE INTO TWO TAGS. If the resume prints "Acme Corp | Software Engineer | Toronto, ON    May 2024 - Present" on one line, that is ONE <line> containing all of it. Do not separate the employer, the role, the location or the dates - they share a line and must stay on it.

5. NEVER MERGE TWO PRINTED LINES INTO ONE TAG. Once two lines are inside one tag nothing downstream can tell where one ended and the next began.
   WRONG - two bullets run together, boundary gone:
     <bullet>Published research in Arseam Foundation Built a linear regression model</bullet>
   Notice "Foundation Built" - a capital letter straight after the end of a sentence. If you find yourself writing that, you are merging lines and must stop.

6. Some lines contain a tab, written as \\t, which pushes what follows it to the right margin - usually a date. Keep it exactly where it is. Never add one, never remove one, never replace it with spaces.

7. One <section> per heading printed on the resume, in the order they appear. Copy each <heading> exactly: "RELEVANT EXPERIENCE" stays "RELEVANT EXPERIENCE", "Technical Skills" stays "Technical Skills". Never substitute a more standard name, never split one section into two, never merge two into one.

8. Put every line in the section it was PRINTED UNDER, always. If a publication appears under the EXPERIENCE heading, its lines belong to that section - not to a section of its own, and not moved somewhere they fit better. The resume's layout is the answer, whatever it looks like to you.

9. Lines above the first heading - a summary paragraph - go in a section with an EMPTY <heading>.

10. Never drop a line. Every line of the resume appears exactly once in the output. A section with several paragraphs gets several <line> tags, one each.

11. Strip the bullet glyph from the start of a bullet's text, but use it first to tell where each line begins.

12. Escape &, < and > as &amp;, &lt; and &gt;.

13. Keep web and email addresses exactly as given, including any in brackets after a label - "LinkedIn (linkedin.com/in/jane)" is copied WHOLE. That is how the finished document rebuilds the link.`;

/** The instruction for one attempt, including what the last one got wrong. */
function prompt(input: string, attempt: number, lastError: unknown): string {
  if (attempt === 0) return `Transcribe this resume into the tagged format:

${input}`;

  const complaint = lastError instanceof Error ? lastError.message : String(lastError);
  return `Your previous attempt was rejected.

${complaint}

Try again. Output ONLY the tagged document, starting with <resume> and ending with </resume>.

${input}`;
}

/**
 * Parses raw resume text into a ResumeDoc.
 *
 * Up to three attempts, and the bar is not just "it parsed" - the result has
 * to actually contain the resume. A transcription that quietly dropped two
 * bullets parses and renders perfectly, so nothing but comparing it against
 * the source will catch it.
 */
export async function parseResumeText(
  rawText: string
): Promise<{ doc: ResumeDoc; tagged: string }> {
  const trimmed = rawText.trim();
  if (!trimmed) throw new Error('The uploaded file contained no readable text');

  // Guard against a pathological PDF blowing the context window.
  const input = trimmed.slice(0, 40_000);

  let lastError: unknown;

  // The best attempt so far, kept in case none clears the coverage bar - a
  // resume missing one line beats no resume at all.
  let best: { doc: ResumeDoc; coverage: number } | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await generateText(SYSTEM_PROMPT, prompt(input, attempt, lastError), MAX_TOKENS);

    try {
      const doc = taggedToDoc(raw);
      const report = checkCompleteness(doc, input);

      if (report.coverage >= MIN_COVERAGE) {
        // Re-serialise rather than returning the model's raw text: the doc is
        // now the source of truth, and this guarantees the tagged string the
        // browser sees is exactly what the doc represents.
        return { doc, tagged: docToTagged(doc) };
      }

      if (!best || report.coverage > best.coverage) best = { doc, coverage: report.coverage };

      // Quoting the dropped lines back works far better than repeating the
      // rule: the next attempt is given the specific text it left out.
      lastError = new Error(
        `You left out ${report.missing.length} line(s) of the resume. Every one of these must appear in your output:\n${report.missing
          .slice(0, 12)
          .map((line) => `- ${line}`)
          .join('\n')}`
      );
    } catch (e) {
      lastError = e;
    }
  }

  if (best) {
    // Returned rather than refused, but recorded: a resume that never reaches
    // full coverage is a prompt problem worth knowing about.
    Sentry.captureMessage('Resume transcription incomplete after retries', {
      level: 'warning',
      extra: { coverage: best.coverage },
    });
    return { doc: best.doc, tagged: docToTagged(best.doc) };
  }

  throw new Error(
    `Could not read that resume: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

/** A parsed resume, plus the plain text the rest of the app stores. */
export interface ParsedResume {
  doc: ResumeDoc;
  tagged: string;
  text: string;
}

/**
 * Parses an uploaded resume file.
 *
 * Two genuinely different paths, and the difference is how much has to be
 * trusted:
 *
 *   .docx - the file states every line, its order and whether it is a bullet.
 *   All of that is read. The model is asked only which lines are headings, and
 *   every number it returns is checked against the file. No content passes
 *   through it, so no content can be lost, reworded or moved, and each line
 *   keeps a reference to its own paragraph so a download can write the tailored
 *   words back into the user's document rather than a copy of it.
 *
 *   PDF - there is no structure to read, so the model has to retype the resume
 *   and a retyped resume can lose a line. That path keeps the completeness
 *   check and its retries.
 */
export async function parseResumeFile(buffer: Buffer, docx: boolean): Promise<ParsedResume> {
  if (docx) {
    const paragraphs = await extractDocxParagraphs(buffer);
    if (paragraphs) {
      const doc = await docFromParagraphs(paragraphs);
      return { doc, tagged: docToTagged(doc), text: docToPlainText(doc) };
    }
  }

  const text = await extractResumeText(buffer, docx);
  const { doc, tagged } = await parseResumeText(text);
  return { doc, tagged, text };
}
