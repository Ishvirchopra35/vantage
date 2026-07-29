// SERVER-SIDE ONLY - the default Vantage template.
//
// When a user has not uploaded a Word template there is nothing to inject
// into, so we build a clean document from scratch with the `docx` library.
// This is the default every user gets until they upload their own file, so it
// has to look like a resume somebody would actually send - not a debug dump.
//
// It honours the same section settings as the template path. If it did not,
// turning a section off would appear to work until the day someone generated
// without a template and it silently came back.

import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  Tab,
  TabStopPosition,
  TabStopType,
  TextRun,
  type ParagraphChild,
} from 'docx';
import { blockSlot, hasContent, normaliseSection, type ResumeDoc } from '@/lib/tagged/schema';
import { splitRuns } from './links';

/** Formatting shared by every run in one field. */
interface RunOptions {
  bold?: boolean;
  italics?: boolean;
  size?: number;
}

/**
 * Renders a field as docx runs, turning any address it contains into a real
 * hyperlink. The no-template path has to preserve links just as carefully as
 * the template path - a user without a template is not a user who cares less
 * about their portfolio being clickable.
 */
function children(
  text: string,
  options: RunOptions = {},
  addressesExpected = false
): ParagraphChild[] {
  return splitRuns(text, { addressesExpected }).flatMap((part): ParagraphChild[] => {
    if (part.href) {
      return [
        new ExternalHyperlink({
          children: [new TextRun({ ...options, text: part.text, style: 'Hyperlink' })],
          link: part.href,
        }),
      ];
    }

    // A tab has to be a Tab element, not a tab character inside the text.
    // Word only advances to a tab stop for the element; a literal tab in a
    // <w:t> renders as nothing and the date stops being right-aligned.
    const pieces = part.text.split('\t');
    return pieces.flatMap((piece, i) => [
      ...(i > 0 ? [new TextRun({ ...options, children: [new Tab()] })] : []),
      ...(piece ? [new TextRun({ ...options, text: piece })] : []),
    ]);
  });
}

/**
 * A right tab stop at the margin, so a trailing date lands there.
 *
 * A tab in the text is the resume right-aligning its dates. Without a stop to
 * aim at, the tab jumps to the next default position and the date sits in the
 * middle of the line.
 */
const RIGHT_TAB = [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }];

/** The paragraph options a line needs, given whether it right-aligns a tail. */
function tabbed(text: string): { tabStops?: typeof RIGHT_TAB } {
  return text.includes('	') ? { tabStops: RIGHT_TAB } : {};
}

function heading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24 })],
    spacing: { before: 240, after: 120 },
  });
}

/** Builds a clean, unbranded resume document. */
export async function buildFallbackDocx(doc: ResumeDoc): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];

  if (doc.name.trim()) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: doc.name.trim(), bold: true, size: 32 })],
        alignment: AlignmentType.CENTER,
      })
    );
  }

  if (doc.contact.trim()) {
    paragraphs.push(
      new Paragraph({
        // The contact line is the one field where a bare "janedoe.dev" is an
        // address rather than a piece of vocabulary.
        children: children(doc.contact.trim(), { size: 20 }, true),
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      })
    );
  }

  // The resume's own sections, in its own order, under its own headings, with
  // its own lines in the order it printed them.
  for (const raw of doc.sections) {
    const section = normaliseSection(raw);
    if (!hasContent(section)) continue;

    if (section.heading.trim()) paragraphs.push(heading(section.heading.trim()));

    section.blocks.forEach((block, index) => {
      const text = block.text.trim();
      if (!text) return;

      if (block.bullet) {
        paragraphs.push(new Paragraph({ children: children(text), bullet: { level: 0 } }));
        return;
      }

      // A line that introduces bullets is the one naming an employer, a
      // project or a degree, and every resume layout gives it more weight.
      const lead = blockSlot(section.blocks, index) === 'entryLine';
      paragraphs.push(
        new Paragraph({
          children: children(text, { bold: lead }),
          ...(lead ? { spacing: { before: 160 } } : {}),
          ...tabbed(text),
        })
      );
    });
  }

  const document = new Document({ sections: [{ children: paragraphs }] });
  // Packer.toBuffer returns a Node Buffer under the Node runtime.
  return Packer.toBuffer(document) as unknown as Promise<Buffer>;
}
