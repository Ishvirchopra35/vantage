// SERVER-SIDE ONLY - renders a ResumeDoc as a PDF.
//
// WHAT THIS IS NOT: a converter. Turning the generated .docx into a PDF would
// need a Word rendering engine - LibreOffice or Word itself - and neither runs
// on a serverless function. So the PDF is drawn from the same ResumeDoc the
// .docx is built from, using the same section order and the same link
// handling. Both files always say the same thing.
//
// The consequence, which the UI states plainly rather than hiding: a user with
// their own Word template gets that template's design in the .docx and this
// layout in the PDF. The .docx is the format that carries their design, which
// is why it stays the primary download.

// The standalone build, not the default entry point. pdfkit's normal build
// reads its standard-font metrics (Helvetica.afm and friends) off disk at
// runtime with a path derived from __dirname, which a bundler rewrites - under
// Next it resolved to a "C:\ROOT\..." path that does not exist and every PDF
// failed with ENOENT. The standalone build inlines those metrics behind a
// virtual filesystem, so there is no disk read to get wrong, in dev or on a
// serverless function where node_modules may not be laid out as expected.
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import { blockSlot, hasContent, normaliseSection, type ResumeDoc } from '@/lib/tagged/schema';
import { collapseLinkText, splitAtTab, splitRuns } from './links';

// Letter, with the tight margins a one-page resume needs.
const MARGIN = 54; // 0.75in
const PAGE_WIDTH = 612;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const BODY_SIZE = 9.5;
const NAME_SIZE = 17;
const HEADING_SIZE = 9.5;

const INK = '#000000';
const LINK = '#0563C1';

type Doc = InstanceType<typeof PDFDocument>;

/**
 * Strips characters the standard PDF fonts cannot encode.
 *
 * A tab is the one that matters. Resumes right-align their dates with one, so
 * a project title routinely arrives as "…OpenSCAD\tFeb. 2026" - and pdfkit's
 * built-in fonts have no glyph for a tab, so it emits a replacement glyph that
 * also swallows the character after it. "\tJun. 2024" came out as "” un. 2024",
 * and every date on the resume was quietly wrong in a way that looked like an
 * encoding fault somewhere far upstream.
 *
 * A tab means "put space here", and a space is the closest this layout can get
 * to it - the PDF is a single flowing column with no tab stops to align to.
 */
function printable(text: string): string {
  // Tested by code point rather than a regex character class: the class needs
  // escaped control characters, and an editor that writes them literally turns
  // this file into something git and grep both treat as binary.
  let out = '';
  for (const character of text) {
    out += character.charCodeAt(0) < 0x20 ? ' ' : character;
  }
  return out.replace(/ {2,}/g, ' ').trim();
}

/**
 * Writes one line, turning any address it contains into a clickable link.
 *
 * pdfkit lays text out by appending runs with `continued`, so a line is built
 * piece by piece and only the last piece ends it. `link` attaches a real PDF
 * link annotation, which is what makes the address clickable in a reader
 * rather than merely coloured.
 */
function line(
  doc: Doc,
  text: string,
  options: {
    bold?: boolean
    italic?: boolean
    size?: number
    indent?: number
    align?: 'left' | 'center'
    /** Read bare dotted words as addresses. True for the contact line only. */
    addressesExpected?: boolean
  } = {}
): void {
  const size = options.size ?? BODY_SIZE;
  const font = options.bold
    ? 'Helvetica-Bold'
    : options.italic
      ? 'Helvetica-Oblique'
      : 'Helvetica';

  // A tab means the resume right-aligned what follows it - a date against the
  // right margin. The tail is drawn separately at the right edge, on the same
  // baseline, which is what reproduces that layout. printable() would
  // otherwise flatten the tab to a space and the date would sit mid-line.
  const tabbed = splitAtTab(text);
  const body = tabbed ? tabbed.left : text;

  const parts = splitRuns(printable(body), {
    addressesExpected: options.addressesExpected ?? false,
  }).filter((part) => part.text);
  if (parts.length === 0 && !tabbed) return;

  const indent = options.indent ?? 0;
  const width = CONTENT_WIDTH - indent;

  doc.font(font).fontSize(size);

  // Centring is done by hand rather than with pdfkit's align option.
  // `align: 'center'` and `continued: true` do not compose: each continued run
  // is centred against the full column independently, so the pieces of a
  // contact line land on top of each other instead of in sequence. Measuring
  // the whole line and starting it at the right x centres it correctly, and
  // every run after the first simply continues from where the last one ended.
  //
  // Only single-run lines can safely delegate to pdfkit, and even then there
  // is no reason to special-case them.
  // Same reason as in bullet(): the first run is positioned at an explicit y,
  // which pdfkit will honour even when that y is past the bottom of the page.
  ensureSpace(doc, doc.heightOfString(parts.map((part) => part.text).join(''), { width }));

  const centred = options.align === 'center';
  const measured = centred
    ? parts.reduce((total, part) => total + doc.widthOfString(part.text), 0)
    : 0;
  const x = centred
    ? MARGIN + indent + Math.max(0, (width - measured) / 2)
    : MARGIN + indent;

  parts.forEach((part, i) => {
    const last = i === parts.length - 1;
    const runOptions = {
      // A centred line is positioned manually, so it must not also be told to
      // align - and its width has to allow the remainder of the line to sit to
      // the right of where it starts.
      width: centred ? MARGIN + width - x : width,
      align: 'left' as const,
      continued: !last,
      link: part.href ?? null,
      underline: Boolean(part.href),
    };

    doc.fillColor(part.href ? LINK : INK);

    // The first run positions the line; the rest continue from wherever it
    // left off. Those MUST use the two-argument form - passing an explicit
    // `undefined` for x and y instead sends pdfkit down a path where the link
    // annotation is silently dropped, so the address renders blue and
    // underlined but does nothing when clicked.
    if (i === 0) {
      doc.text(part.text, x, doc.y, runOptions);
    } else {
      doc.text(part.text, runOptions);
    }
  });

  if (tabbed) {
    // Drawn on the line just written, hard against the right margin.
    //
    // currentLineHeight(true) - WITH the line gap. text() advances doc.y by the
    // height including the gap, so subtracting the height without it lands the
    // tail a couple of points below the text it belongs beside. Small enough to
    // look like nothing on screen and obvious in print: every date on the
    // resume sitting fractionally low.
    const withGap = doc.currentLineHeight(true);
    const tail = printable(tabbed.right);
    const top = doc.y - withGap;
    doc
      .fillColor(INK)
      .text(tail, MARGIN, top, { width: CONTENT_WIDTH, align: 'right', lineBreak: false });
    doc.y = top + withGap;
  }

  doc.fillColor(INK);
}

/**
 * Starts a new page if `height` will not fit in what is left of this one.
 *
 * pdfkit paginates by itself, but only for text it is left to position. Every
 * line here is drawn at an explicit y - the first run of a line so it can be
 * centred, and a bullet's glyph so the text beside it shares a baseline - and
 * an explicit y is taken as an instruction, not a suggestion. So a line that
 * ran past the bottom margin was simply drawn past it: still in the file, and
 * still extractable by a text parser, but below the visible area of the page.
 * That is why the last line of a long resume vanished while everything else
 * looked fine.
 */
function ensureSpace(doc: Doc, height: number): void {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

/** A section heading with the rule under it that resumes conventionally use. */
function sectionHeading(doc: Doc, text: string): void {
  doc.moveDown(0.55);
  doc.font('Helvetica-Bold').fontSize(HEADING_SIZE);

  // Enough room for the heading, its rule, and a line of whatever follows -
  // a heading stranded alone at the foot of a page is its own kind of broken.
  ensureSpace(doc, doc.currentLineHeight() + BODY_SIZE * 2.4);

  doc
    .fillColor(INK)
    .text(text.toUpperCase(), MARGIN, doc.y, { width: CONTENT_WIDTH, characterSpacing: 0.6 });

  const y = doc.y + 1.5;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).lineWidth(0.5).strokeColor(INK).stroke();
  doc.moveDown(0.35);
}

/** A bulleted line, with the glyph drawn separately so text wraps cleanly. */
function bullet(doc: Doc, text: string): void {
  const indent = 16;
  const width = CONTENT_WIDTH - indent;

  doc.font('Helvetica').fontSize(BODY_SIZE);
  // Measured on the collapsed text, since that is what actually gets drawn.
  ensureSpace(doc, doc.heightOfString(collapseLinkText(text), { width }));

  // The glyph and the text share a baseline, which means restoring y between
  // the two draws. That reset is only safe because ensureSpace has already
  // guaranteed both fit on the current page.
  const y = doc.y;
  doc.fillColor(INK).text('•', MARGIN + 4, y, { width: 10, lineBreak: false });
  doc.y = y;
  line(doc, text, { indent });
}

/**
 * Renders `doc` as a PDF. Section order and skip rules mirror buildBodyXml in
 * lib/docx/inject.ts, so the two downloads never disagree about what is in the
 * resume.
 */
export async function buildResumePdf(resume: ResumeDoc): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    autoFirstPage: true,
    info: { Title: resume.name || 'Resume' },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  if (resume.name.trim()) {
    line(doc, resume.name.trim(), { bold: true, size: NAME_SIZE, align: 'center' });
    doc.moveDown(0.2);
  }

  if (resume.contact.trim()) {
    line(doc, resume.contact.trim(), { align: 'center', addressesExpected: true });
  }

  // The resume's own sections, in its own order, under its own headings, with
  // its own lines in the order it printed them.
  for (const raw of resume.sections) {
    const section = normaliseSection(raw);
    if (!hasContent(section)) continue;

    if (section.heading.trim()) sectionHeading(doc, section.heading.trim());
    else doc.moveDown(0.4);

    section.blocks.forEach((block, index) => {
      const text = block.text.trim();
      if (!text) return;

      if (block.bullet) {
        bullet(doc, text);
        return;
      }

      // A line introducing bullets names an employer, a project or a degree,
      // and gets the weight and the space above that every resume gives it.
      const lead = blockSlot(section.blocks, index) === 'entryLine';
      if (lead) doc.moveDown(0.25);
      line(doc, text, { bold: lead });
    });
  }

  doc.end();
  return finished;
}
