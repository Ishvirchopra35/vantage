// SERVER-SIDE ONLY - applies a free-text instruction to a tagged resume.
//
// This is Resume Studio's editing pass, and its guarantee is deliberately
// weaker than tailoring's. lib/tagged/tailor.ts asserts the tag skeleton is
// unchanged, because a tailoring that quietly deleted a job would be a
// disaster. Here the user is *asking* for structural change - "move Projects
// above Experience", "cut the summary", "drop my first internship" - so a
// skeleton lock would reject exactly the edits the feature exists to make.
//
// What is still guaranteed: the result parses as a valid tagged document with
// no tags outside the vocabulary. So an edit can restructure the resume, but
// it cannot produce something the .docx generator will choke on, and it cannot
// invent a section that silently disappears downstream.

import { docToTagged, taggedToDoc } from '@/lib/tagged/serialize';
import type { ResumeDoc } from '@/lib/tagged/schema';
import { generateText } from '@/lib/ai';

const MAX_TOKENS = 8000;

const SYSTEM_PROMPT = `You edit resumes written in a strict tagged format. You apply one instruction and return the FULL updated document.

Output EXACTLY the same tag vocabulary you were given and nothing else - no markdown, no code fences, no commentary. The document starts with <resume> and ends with </resume>.

The only tags that may ever appear: resume, name, contact, section, heading, line, bullet. NEVER invent a tag.

A resume is a name, a contact line, and sections. A <section> is a <heading> and the lines printed under it: <bullet> for a line printed with a bullet glyph, <line> for everything else - an employer, a job title, a degree, a date, a skills list, a summary sentence.

RULES
1. Apply ONLY what the instruction asks. Everything it does not mention comes back character for character unchanged.
2. The instruction may add, remove or reorder <line>, <bullet> and <section> elements - that is allowed here. Do not make structural changes it did not ask for.
3. Keep each line whole. A <line> like "Acme Corp | Engineer | Toronto, ON\\tMay 2024" is ONE line the resume printed; never split it into several, and never merge two lines into one.
4. "\\t" is a tab that pushes what follows it to the right margin, usually a date. Keep it exactly where it is unless the instruction is about that date.
5. NEVER invent employers, job titles, degrees, schools, dates, numbers or metrics that are not already in the document or explicitly supplied in the instruction.
6. Keep web and email addresses exactly as written. They are how the finished Word file rebuilds the candidate's links, and a changed address is a dead link.
7. If the instruction is unclear or would require inventing facts, return the document unchanged rather than guessing.
8. Escape &, < and > inside text as &amp;, &lt; and &gt;.`;

export interface EditResult {
  doc: ResumeDoc;
  /** True when both attempts produced something unparseable. */
  failed: boolean;
}

/** Applies `instruction` to `doc`, returning it unchanged if the AI fails. */
export async function editTagged(doc: ResumeDoc, instruction: string): Promise<EditResult> {
  const tagged = docToTagged(doc);
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? `CURRENT RESUME:\n${tagged}\n\nINSTRUCTION: ${instruction}\n\nReturn the full updated tagged document.`
        : `Your previous attempt was rejected: ${
            lastError instanceof Error ? lastError.message : String(lastError)
          }\n\nTry again. Output ONLY the tagged document, starting with <resume> and ending with </resume>.\n\nCURRENT RESUME:\n${tagged}\n\nINSTRUCTION: ${instruction}`;

    const raw = await generateText(SYSTEM_PROMPT, prompt, MAX_TOKENS);

    try {
      // Success is "our own parser accepts it", not "the model said it was
      // done" - taggedToDoc rejects unknown tags and missing wrappers.
      return { doc: taggedToDoc(raw), failed: false };
    } catch (e) {
      lastError = e;
    }
  }

  return { doc, failed: true };
}
