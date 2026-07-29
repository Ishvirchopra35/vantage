// SERVER-SIDE ONLY - builds a ResumeDoc from a .docx's own paragraphs.
//
// The important thing here is what the AI is NOT asked to do. It does not
// transcribe the resume, so it cannot drop a bullet, merge two lines, reword a
// job title or move a date onto a different line. Every line's text, order and
// bullet-ness is read from word/document.xml, which already states all three
// exactly.
//
// The only judgement left is which lines are section headings, and which are
// the name and the contact line. That is a genuine reading of the document
// rather than a formatting decision, it is a handful of numbers rather than a
// retyped resume, and every number that comes back is checked against the file
// before it is believed.

import * as Sentry from '@sentry/nextjs';
import { generateJSON } from '@/lib/ai';
import type { SourceParagraph } from '@/lib/docx/paragraphs';
import { normaliseBlock, type ResumeDoc, type ResumeSection } from './schema';

/** What the model is asked for: three sets of line numbers, nothing more. */
interface StructureAnswer {
  nameLine?: number;
  contactLine?: number;
  headingLines?: number[];
}

const SYSTEM_PROMPT = `You are given the numbered lines of a resume. You identify its structure. You never rewrite anything - your entire output is line numbers.

Return JSON exactly like this:
{"nameLine": 0, "contactLine": 1, "headingLines": [2, 8, 15]}

- nameLine: the line holding the candidate's name.
- contactLine: the line holding their contact details (phone, email, links). Omit if there is none.
- headingLines: every line that is a SECTION HEADING - a label introducing the lines beneath it, like "EDUCATION", "RELEVANT EXPERIENCE", "TECHNICAL SKILLS", "PROJECTS". In the order they appear.

RULES
1. A section heading labels a group of lines. It is not a job, a project, a degree or a skill.
2. Copy the resume's own headings, whatever they are. Do not expect a particular set and do not skip a heading because it is unusual.
3. A line marked [bullet] is never a heading, a name or a contact line.
4. Never invent a line number. Every number must be one of the numbered lines given.
5. Output only the JSON object.`;

/** The numbered listing the model reads. */
function listing(paragraphs: SourceParagraph[]): string {
  return paragraphs
    .map((p) => `${p.index}${p.bullet ? ' [bullet]' : ''}: ${p.text.replace(/\t/g, '  ')}`)
    .join('\n');
}

/** Asks which lines are structural, and believes only what the file confirms. */
async function readStructure(paragraphs: SourceParagraph[]): Promise<StructureAnswer> {
  const answer = await generateJSON<StructureAnswer>(SYSTEM_PROMPT, listing(paragraphs), 2000);

  // A line number is only accepted if it exists and is not a bullet. The model
  // never supplies text, so this is the whole of what has to be trusted - and
  // a wrong number degrades a heading, it cannot lose a line.
  const usable = (value: unknown): value is number =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < paragraphs.length &&
    !paragraphs[value].bullet &&
    paragraphs[value].text.trim().length > 0;

  return {
    nameLine: usable(answer?.nameLine) ? answer.nameLine : undefined,
    contactLine: usable(answer?.contactLine) ? answer.contactLine : undefined,
    headingLines: (Array.isArray(answer?.headingLines) ? answer.headingLines : [])
      .filter(usable)
      .sort((a, b) => a - b),
  };
}

/**
 * Assembles the document. Pure, and separated from the AI call so the assembly
 * can be tested against a real resume's paragraphs without one.
 */
export function assemble(
  paragraphs: SourceParagraph[],
  structure: StructureAnswer
): ResumeDoc {
  const headings = new Set(structure.headingLines ?? []);
  const consumed = new Set<number>();

  const doc: ResumeDoc = { name: '', contact: '', sections: [] };

  if (structure.nameLine !== undefined) {
    doc.name = paragraphs[structure.nameLine].text.trim();
    doc.nameSource = structure.nameLine;
    consumed.add(structure.nameLine);
  }
  if (structure.contactLine !== undefined) {
    doc.contact = paragraphs[structure.contactLine].text.trim();
    doc.contactSource = structure.contactLine;
    consumed.add(structure.contactLine);
  }

  // Every remaining line joins the section it appears under. Lines before the
  // first heading go in a section with no heading of its own, which is where a
  // summary paragraph belongs.
  let current: ResumeSection | null = null;

  for (const paragraph of paragraphs) {
    if (consumed.has(paragraph.index)) continue;
    // Empty paragraphs are spacers. They stay in the file untouched, but they
    // are not lines of the resume and must not become editable blank rows.
    if (!paragraph.text.trim()) continue;

    if (headings.has(paragraph.index)) {
      current = {
        heading: paragraph.text.trim(),
        blocks: [],
        headingSource: paragraph.index,
      };
      doc.sections.push(current);
      continue;
    }

    if (!current) {
      current = { heading: '', blocks: [] };
      doc.sections.push(current);
    }

    current.blocks.push(
      normaliseBlock({
        bullet: paragraph.bullet,
        // Verbatim, tab and all. This is the line the resume printed.
        text: paragraph.text,
        source: paragraph.index,
      })
    );
  }

  return doc;
}

/**
 * A ResumeDoc built from the paragraphs of the user's own .docx.
 *
 * Content is never at risk here: it is copied from the file, and the AI's only
 * contribution is which lines are headings. Compare the PDF path, where the
 * text has no structure to read and the model has to retype the resume - that
 * one needs a completeness check because a retyped resume can lose a line.
 */
export async function docFromParagraphs(paragraphs: SourceParagraph[]): Promise<ResumeDoc> {
  try {
    return assemble(paragraphs, await readStructure(paragraphs));
  } catch (e) {
    Sentry.captureMessage('Could not read resume structure; falling back to a flat document', {
      level: 'warning',
      extra: { reason: e instanceof Error ? e.message : String(e) },
    });
    // One long unnamed section: a poor document but an honest one. It says
    // exactly what the file says, in order, with every line present - a far
    // better failure than inventing headings and filing content under them.
    return assemble(paragraphs, { headingLines: [] });
  }
}
