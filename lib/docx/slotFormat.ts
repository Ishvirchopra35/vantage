// What each part of the resume looks like when the template cannot say.
//
// The template engine's first choice is always the user's own paragraph
// styles - that is what makes an injected document look like theirs. The
// problem is that almost no real resume defines any. A .docx exported from
// Word typically declares Heading1-6, Title, ListParagraph and Strong, and
// achieves everything else with direct formatting: the name is bold and
// centred because someone selected it and pressed the buttons, not because it
// carries a "Candidate Name" style.
//
// So suggestMapping finds a home for maybe half our slots, and without a
// fallback the rest inherit Normal - left-aligned 11pt body text. The name,
// the contact line and every section heading collapse into an undifferentiated
// block, which is the "everything is gathered up in one spot" failure.
//
// This table is what those slots use instead. It is applied ONLY where the
// template has no style of its own, so a template that does define styles is
// still followed exactly. The font itself is never set here: that comes from
// the template's own docDefaults, so the document still reads in their
// typeface even when the layout is ours.

import type { StyleSlot } from '@/lib/tagged/schema';

export interface SlotFormat {
  bold?: boolean;
  italics?: boolean;
  caps?: boolean;
  /** Font size in half-points, as Word measures it: 20 = 10pt. */
  size?: number;
  align?: 'center';
  /** Space above and below, in twentieths of a point: 240 = 12pt. */
  before?: number;
  after?: number;
  /** Left indent in twips, with `hanging` pulling the first line back. */
  indent?: number;
  hanging?: number;
  /** A rule under the text, the usual resume section-heading treatment. */
  rule?: boolean;
  /** Prefix with a bullet glyph rather than relying on numbering.xml. */
  bulleted?: boolean;
}

/**
 * Deliberately tight: a resume that was one page before tailoring has to stay
 * one page after it, and generous spacing is the quickest way to lose that.
 */
export const SLOT_FORMATS: Record<StyleSlot, SlotFormat> = {
  name: { bold: true, size: 30, align: 'center', after: 40 },
  contact: { size: 19, align: 'center', after: 140 },
  sectionHeading: { bold: true, caps: true, size: 20, before: 200, after: 60, rule: true },
  entryLine: { bold: true, size: 20, before: 120 },
  line: { size: 19, after: 40 },
  bullet: { size: 19, indent: 360, hanging: 180, bulleted: true },
};

/**
 * The <w:pPr> body for a slot's fallback formatting.
 *
 * Child order is not cosmetic - OOXML defines a fixed sequence for pPr, and
 * Word rejects a document whose properties appear out of order. pBdr, then
 * spacing, then ind, then jc.
 */
/**
 * Where the right margin is, in twips, when the document does not say.
 *
 * Letter width less one-inch margins.
 */
const DEFAULT_CONTENT_WIDTH_TWIPS = 9360;

/**
 * The content width of a document, read from its own <w:sectPr>.
 *
 * This has to be read rather than assumed. A tab stop is an absolute position,
 * so a hardcoded 9360 puts the date wherever 6.5 inches happens to fall in
 * THAT document - on a page with half-inch margins that is an inch and a half
 * short of the margin, which reads exactly as the reported symptom: a date that
 * looks tabbed across rather than right-aligned.
 */
export function contentWidthTwips(documentXml: string): number {
  const section = documentXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>|<w:sectPr[^>]*\/>/);
  if (!section) return DEFAULT_CONTENT_WIDTH_TWIPS;

  const width = Number(section[0].match(/<w:pgSz[^>]*\sw:w="(\d+)"/)?.[1]);
  const margins = section[0].match(/<w:pgMar[^>]*>/)?.[0] ?? '';
  const left = Number(margins.match(/\sw:left="(\d+)"/)?.[1]);
  const right = Number(margins.match(/\sw:right="(\d+)"/)?.[1]);

  if (!Number.isFinite(width) || !Number.isFinite(left) || !Number.isFinite(right)) {
    return DEFAULT_CONTENT_WIDTH_TWIPS;
  }

  const content = width - left - right;
  // A nonsensical page setup falls back rather than producing a stop at a
  // negative position, which Word treats as no stop at all.
  return content > 720 ? content : DEFAULT_CONTENT_WIDTH_TWIPS;
}

/**
 * A right-aligned tab stop at the margin, so a trailing date lands there.
 *
 * `position` comes from the document being written into. Passing nothing uses
 * the built-in layout's own margins.
 */
export function rightTabStop(position = DEFAULT_CONTENT_WIDTH_TWIPS): string {
  return `<w:tabs><w:tab w:val="right" w:pos="${position}"/></w:tabs>`;
}

export function paragraphProperties(format: SlotFormat): string {
  const parts: string[] = [];

  if (format.rule) {
    parts.push('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>');
  }

  const spacing = [
    format.before === undefined ? '' : ` w:before="${format.before}"`,
    format.after === undefined ? '' : ` w:after="${format.after}"`,
  ].join('');
  // line/lineRule pinned to single so the paragraph does not inherit a
  // template's 1.5-spaced Normal and double the resume's length.
  if (spacing) parts.push(`<w:spacing${spacing} w:line="240" w:lineRule="auto"/>`);

  if (format.indent !== undefined) {
    const hanging = format.hanging === undefined ? '' : ` w:hanging="${format.hanging}"`;
    parts.push(`<w:ind w:left="${format.indent}"${hanging}/>`);
  }

  if (format.align === 'center') parts.push('<w:jc w:val="center"/>');

  return parts.join('');
}

/** The <w:rPr> body for a slot's fallback formatting. */
export function runProperties(format: SlotFormat): string {
  const parts: string[] = [];
  if (format.bold) parts.push('<w:b/>');
  if (format.italics) parts.push('<w:i/>');
  if (format.caps) parts.push('<w:caps/>');
  if (format.size !== undefined) {
    parts.push(`<w:sz w:val="${format.size}"/><w:szCs w:val="${format.size}"/>`);
  }
  return parts.join('');
}
