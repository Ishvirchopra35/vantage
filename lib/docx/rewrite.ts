// SERVER-SIDE ONLY - writes tailored text back into the user's own .docx.
//
// This replaces rebuilding the document. The old template engine emptied
// <w:body> and filled it with paragraphs we generated, styled by referencing
// the template's style ids. That preserves fonts and margins but not the
// document: a line the resume printed as "Employer | Role | Location<TAB>Dates"
// with the employer bold and the location not came back as our idea of an entry
// title, because our idea of an entry title was the only shape available.
//
// Here nothing is recreated. Every paragraph of the user's file is emitted
// exactly as it was, except the ones whose words changed - and those keep their
// own paragraph properties and their own run formatting. Fonts, spacing, tab
// stops, list numbering, borders, headers, footers, images and hyperlinks
// survive because no code ever touches them.
//
// The correspondence is by index: block.source is the paragraph the line came
// from, assigned when the file was read and preserved through tailoring by the
// skeleton check. Nothing is matched by text, so a rewritten bullet cannot be
// matched to the wrong paragraph.

import JSZip from 'jszip';
import { escapeXml } from '@/lib/tagged/serialize';
import { normaliseSection, type ResumeDoc } from '@/lib/tagged/schema';
import { readParagraphs, splitBody, type SourceParagraph } from './paragraphs';

const DOCUMENT_PATH = 'word/document.xml';

/** The <w:t> and <w:tab/> elements for a line's text. */
function textElements(text: string): string {
  // A tab is written as <w:tab/>, never as a tab character inside <w:t>. Word
  // only advances to a tab stop for the element; a literal tab in the text is
  // rendered as nothing much and the date stops being right-aligned.
  return escapeXml(text)
    .split('\n')
    .map((line) =>
      line
        .split('\t')
        .map((part) => `<w:t xml:space="preserve">${part}</w:t>`)
        .join('<w:tab/>')
    )
    .join('<w:br/>');
}

/** The run properties of the first run that actually carries text. */
function leadRunProperties(paragraphXml: string): string {
  for (const run of paragraphXml.matchAll(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g)) {
    if (!/<w:t(?:\s[^>]*)?>/.test(run[1])) continue;
    const properties = run[1].match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
    return properties ? properties[0] : '';
  }
  return '';
}

/** A paragraph's own <w:pPr>, which is everything about how it sits on the page. */
function paragraphProperties(paragraphXml: string): string {
  const match = paragraphXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  return match ? match[0] : '';
}

/**
 * The user's paragraph with different words in it.
 *
 * Keeps <w:pPr> verbatim - indentation, spacing, tab stops, list numbering, the
 * lot - and adopts the formatting of the paragraph's first text run for the new
 * text. A tailored bullet is uniformly formatted in practice, so one run's
 * properties describe the whole line.
 *
 * The one thing that does not survive is a paragraph's internal run structure:
 * a line that was half bold comes back uniformly formatted, and a hyperlink
 * inside a rewritten line becomes plain text. That only applies to lines whose
 * words actually changed, which is bullets - tailoring never rewrites the lines
 * that carry links and mixed weights, and those are emitted untouched.
 */
function withText(paragraph: SourceParagraph, text: string): string {
  const rPr = leadRunProperties(paragraph.xml);
  return `<w:p>${paragraphProperties(paragraph.xml)}<w:r>${rPr}${textElements(text)}</w:r></w:p>`;
}

/**
 * A new paragraph the user added in the editor, formatted like its neighbours.
 *
 * Cloning the properties of an existing line of the same kind is the only way
 * to make an added bullet look like the bullets around it - there is no style
 * of ours to fall back on, and there should not be.
 */
function clonedParagraph(model: SourceParagraph | undefined, text: string): string {
  if (!model) return `<w:p><w:r>${textElements(text)}</w:r></w:p>`;
  return withText(model, text);
}

/** Every line of the document, paired with the source paragraph it belongs to. */
interface PlannedLine {
  text: string;
  bullet: boolean;
  source?: number;
}

function planLines(doc: ResumeDoc): PlannedLine[] {
  const lines: PlannedLine[] = [];

  // The name and contact line sit outside any section but are still paragraphs
  // of the file, so they have to claim theirs or the walk below would treat
  // them as deleted.
  if (doc.name.trim()) lines.push({ text: doc.name, bullet: false, source: doc.nameSource });
  if (doc.contact.trim()) {
    lines.push({ text: doc.contact, bullet: false, source: doc.contactSource });
  }

  for (const raw of doc.sections) {
    const section = normaliseSection(raw);
    if (section.heading.trim()) {
      lines.push({ text: section.heading, bullet: false, source: section.headingSource });
    }
    for (const block of section.blocks) {
      if (!block.text.trim() && block.source === undefined) continue;
      lines.push({ text: block.text, bullet: block.bullet, source: block.source });
    }
  }

  return lines;
}

/**
 * Whether this document's paragraph references actually belong to this file.
 *
 * They are plain indices, so pointing them at the wrong document does not
 * fail - it writes each line into whatever paragraph happens to sit at that
 * number, quietly scrambling somebody's resume. That is worth a check.
 *
 * It can happen: Resume Studio can open a file that is not the base resume, and
 * a stored document outlives the upload it came from, so a replaced resume
 * leaves references pointing into a file that no longer matches.
 *
 * Lines are the evidence, not bullets. A line is locked through tailoring and
 * only keeps its reference through an edit if its wording was untouched, so a
 * correct reference means the text at that index still matches. Bullets are
 * expected to differ - that is the whole point of tailoring them.
 */
export function sourcesFit(documentXml: string, doc: ResumeDoc): boolean {
  const paragraphs = new Map(readParagraphs(documentXml).map((p) => [p.index, p.text]));

  let checked = 0;
  let matched = 0;

  const check = (source: number | undefined, text: string) => {
    if (source === undefined) return;
    const actual = paragraphs.get(source);
    if (actual === undefined) return;
    checked += 1;
    if (actual.trim() === text.trim()) matched += 1;
  };

  for (const raw of doc.sections) {
    const section = normaliseSection(raw);
    check(section.headingSource, section.heading);
    for (const block of section.blocks) {
      if (!block.bullet) check(block.source, block.text);
    }
  }

  // Too little evidence either way: a short resume, or one whose lines were all
  // edited. Refusing is the safe answer - the document still downloads, just
  // rebuilt rather than rewritten.
  if (checked < 3) return false;
  return matched / checked >= 0.8;
}

/**
 * Rebuilds the body, walking the user's paragraphs in their original order.
 *
 * Exported for tests: it is a pure function of the source XML and the document,
 * so what it produces can be asserted on without building a zip.
 */
export function rewriteBodyXml(documentXml: string, doc: ResumeDoc): string {
  const paragraphs = readParagraphs(documentXml);

  // Each real line, with the blank paragraphs that sat immediately above it.
  //
  // Spacers have to travel with the line below them rather than hold a fixed
  // position, because the editor can reorder. A blank line above EXPERIENCE is
  // the gap before that section - if the user moves the section, the gap moves
  // with it, and if they delete the section the gap goes too rather than
  // leaving a hole where it used to be.
  const lead = new Map<number, string>();
  let pending: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.text.trim()) {
      pending.push(paragraph.xml);
      continue;
    }
    lead.set(paragraph.index, pending.join(''));
    pending = [];
  }
  // Blank paragraphs after the last line belong to the end of the document.
  const trailing = pending.join('');

  const byIndex = new Map(
    paragraphs.filter((p) => p.text.trim()).map((p) => [p.index, p] as const)
  );

  const out: string[] = [];
  const used = new Set<number>();

  // Walked in the DOCUMENT's order, not the file's, so a section moved in the
  // editor actually moves. Each line still emits its own paragraph, so moving
  // it carries its formatting with it.
  for (const line of planLines(doc)) {
    const paragraph = line.source === undefined ? undefined : byIndex.get(line.source);

    if (!paragraph || used.has(paragraph.index)) {
      // No paragraph of its own: a line the user added, or one duplicated by an
      // edit. Formatted like the nearest existing line of the same kind.
      const model = [...byIndex.values()].reverse().find((p) => p.bullet === line.bullet);
      if (line.text.trim()) out.push(clonedParagraph(model, line.text));
      continue;
    }

    used.add(paragraph.index);
    out.push(lead.get(paragraph.index) ?? '');
    // Unchanged is the common case and the important one: emitting the original
    // bytes is what guarantees nothing about the user's formatting drifts.
    out.push(
      line.text === paragraph.text ? paragraph.xml : withText(paragraph, line.text)
    );
  }

  out.push(trailing);
  return out.join('');
}

/**
 * Produces a finished .docx from the user's own file with `doc`'s text in it.
 *
 * Only word/document.xml is touched, and inside it only the paragraphs whose
 * words changed. Everything else in the archive - styles.xml, headers, footers,
 * media, theme, numbering, relationships - is repacked exactly as it arrived.
 */
export async function rewriteDocx(sourceBuffer: Buffer, doc: ResumeDoc): Promise<Buffer> {
  const zip = await JSZip.loadAsync(sourceBuffer);
  const documentFile = zip.file(DOCUMENT_PATH);
  if (!documentFile) {
    throw new Error('That file is not a valid .docx (no word/document.xml).');
  }

  const xml = await documentFile.async('string');
  if (!sourcesFit(xml, doc)) {
    throw new Error('This resume does not match that Word file.');
  }

  const { head, sectPr, tail } = splitBody(xml);

  zip.file(DOCUMENT_PATH, head + rewriteBodyXml(xml, doc) + sectPr + tail);

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
