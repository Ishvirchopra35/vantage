// SERVER-SIDE ONLY - the template engine.
//
// A .docx is a zip archive of XML. Branding lives almost entirely in files we
// never need to touch: styles.xml (fonts, colours, indents, tab stops),
// header1.xml / footer1.xml (logo, page furniture), media/ (images), theme/,
// and the <w:sectPr> block at the end of the body (page size, margins, which
// header and footer this section uses).
//
// So rather than rebuild the user's document, we open theirs and swap out one
// thing: the contents of <w:body>. Everything that makes it *their* template
// survives untouched, and our generated paragraphs adopt the template's
// formatting purely by referencing its own style ids.

import JSZip from 'jszip';
import { escapeXml } from '@/lib/tagged/serialize';
import {
  blockSlot,
  hasContent,
  normaliseSection,
  type ResumeDoc,
  type StyleMapping,
  type StyleSlot,
} from '@/lib/tagged/schema';
import { splitRuns } from './links';
import {
  contentWidthTwips,
  paragraphProperties,
  rightTabStop,
  runProperties,
  SLOT_FORMATS,
} from './slotFormat';

const DOCUMENT_PATH = 'word/document.xml';
const RELS_PATH = 'word/_rels/document.xml.rels';
const HYPERLINK_REL_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';

/**
 * How a paragraph turns an address into something Word can open.
 *
 * Hyperlinks are the one thing that cannot be rendered from the body XML
 * alone: a <w:hyperlink> carries an r:id that has to resolve against
 * word/_rels/document.xml.rels, a different file in the archive. So the
 * relationship bookkeeping lives with injectIntoTemplate rather than with
 * buildBodyXml, which stays a pure function of the document.
 */
export interface LinkContext {
  /** Registers a target and returns the r:id to reference it by. */
  relationshipId(href: string): string;
  /**
   * Whether the template defines a "Hyperlink" character style. When it does we
   * reference it and links pick up the template's own link colour; when it does
   * not, a <w:rStyle> pointing at a missing style would leave the link looking
   * like body text, so we fall back to direct blue-and-underlined formatting.
   */
  hasHyperlinkStyle: boolean;
}

/** The <w:t> elements for one stretch of text, with newlines as soft breaks. */
function textElements(text: string): string {
  // A literal newline inside a field must become a soft line break, not a new
  // paragraph - a new paragraph would restart the style's spacing/numbering.
  //
  // Tabs get their own element too. A tab left inside <w:t> is not how Word
  // records one, and resumes are full of them: they are what right-aligns the
  // date at the end of a project title.
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

/**
 * Renders one field's text as runs, wrapping any addresses in <w:hyperlink>.
 *
 * `baseRunPr` is the slot's fallback character formatting, carried onto every
 * run including linked ones - otherwise a bold contact line would lose its
 * weight the moment it contained an email address.
 */
function runs(text: string, baseRunPr: string, slot: StyleSlot, links?: LinkContext): string {
  const plainRun = (value: string) =>
    `<w:r>${baseRunPr ? `<w:rPr>${baseRunPr}</w:rPr>` : ''}${textElements(value)}</w:r>`;

  if (!links) return plainRun(text);

  // Only the contact line is read as a list of addresses; everywhere else a
  // dotted word like "Node.js" is a technology.
  const parts = splitRuns(text, { addressesExpected: slot === 'contact' });
  if (!parts.some((part) => part.href)) return plainRun(text);

  return parts
    .map((part) => {
      if (!part.text) return '';
      if (!part.href) return plainRun(part.text);

      const decoration = links.hasHyperlinkStyle
        ? '<w:rStyle w:val="Hyperlink"/>'
        : '<w:color w:val="0563C1"/><w:u w:val="single"/>';

      // rStyle must come first in rPr, and the slot's own formatting after it,
      // so a link inherits the template's link colour without losing the
      // size or weight of the line it sits in.
      const id = links.relationshipId(part.href);
      return `<w:hyperlink r:id="${escapeXml(id)}"><w:r><w:rPr>${decoration}${baseRunPr}</w:rPr>${textElements(part.text)}</w:r></w:hyperlink>`;
    })
    .join('');
}

/**
 * One Word paragraph.
 *
 * When the template defines a style for this slot, that style is referenced
 * and nothing else is imposed - the document then looks exactly as the
 * template dictates. When it does not, the slot's fallback formatting from
 * slotFormat.ts is written directly instead. That second path is the common
 * one: real resumes are formatted by hand rather than with named styles, and
 * without it half the document would inherit plain body text.
 */
function paragraph(
  text: string,
  slot: StyleSlot,
  styleId?: string,
  links?: LinkContext,
  rightMargin?: number
): string {
  // A tab in the text is the resume right-aligning its dates. Word needs a
  // right tab stop on the paragraph for the tab to reach the margin; without
  // one it jumps to the next default half-inch stop and the date sits
  // mid-line, looking tabbed across rather than aligned.
  //
  // This applies whether or not the slot has a template style. It used to be
  // skipped in the styled branch, on the reasoning that a template's style
  // says everything - but a paragraph style rarely defines a tab stop, and a
  // style that does not leaves the date with nothing to aim at.
  const tabs = text.includes('\t') ? rightTabStop(rightMargin) : '';

  if (styleId) {
    return `<w:p><w:pPr><w:pStyle w:val="${escapeXml(styleId)}"/>${tabs}</w:pPr>${runs(text, '', slot, links)}</w:p>`;
  }

  const format = SLOT_FORMATS[slot];
  const pPr = tabs + paragraphProperties(format);
  const rPr = runProperties(format);
  // The glyph is written as text with a hanging indent rather than through
  // numbering.xml: a template's numbering definitions are its own, and adding
  // to them risks renumbering the user's existing lists.
  const body = format.bulleted ? `•\t${text}` : text;

  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs(body, rPr, slot, links)}</w:p>`;
}

/**
 * Renders the whole ResumeDoc as Word paragraph XML.
 *
 * Two separate reasons a section can be absent, and they are not the same
 * thing: the candidate had no such content (nothing to print), or the section
 * is switched off (excluded even when the candidate has it). Both are honoured
 * here; only the second is a setting.
 *
 * Empty fields are skipped rather than emitted blank, so a resume with no
 * summary does not open with a mysterious gap where the summary style's
 * spacing used to be.
 *
 * `links` is optional so this stays a pure, directly testable function; without
 * it every address renders as ordinary text.
 */
export function buildBodyXml(
  doc: ResumeDoc,
  mapping: StyleMapping,
  links?: LinkContext,
  /** The template's content width in twips, for the right tab stop. */
  rightMargin?: number
): string {
  const out: string[] = [];

  const push = (text: string, slot: StyleSlot) => {
    if (text.trim()) out.push(paragraph(text.trim(), slot, mapping[slot], links, rightMargin));
  };

  push(doc.name, 'name');
  push(doc.contact, 'contact');

  // One pass over the resume's own sections, in its own order, under its own
  // headings. There is no list of known sections to consult and nothing to
  // append afterwards - what the candidate wrote is what gets printed.
  for (const raw of doc.sections) {
    const section = normaliseSection(raw);
    if (!hasContent(section)) continue;

    push(section.heading, 'sectionHeading');
    section.blocks.forEach((block, index) => {
      push(block.text, blockSlot(section.blocks, index));
    });
  }

  return out.join('');
}

// -- relationships ------------------------------------------------------------

interface LinkTracker extends LinkContext {
  /** The <Relationship> elements to add, in allocation order. */
  elements(): string;
  readonly size: number;
}

/**
 * Tracks hyperlink relationships for one generated document.
 *
 * Ids must not collide with the ones the template already uses for its header,
 * footer, styles and images, so allocation starts above the highest rId in the
 * existing file. Identical targets share an id, which is both what Word itself
 * does and what stops a contact line listing the same address twice from
 * bloating the rels file.
 */
function createLinkTracker(existingRels: string, hasHyperlinkStyle: boolean): LinkTracker {
  let next = 1;
  for (const match of existingRels.matchAll(/Id="rId(\d+)"/g)) {
    next = Math.max(next, Number(match[1]) + 1);
  }

  const byHref = new Map<string, string>();

  return {
    hasHyperlinkStyle,
    relationshipId(href: string): string {
      const existing = byHref.get(href);
      if (existing) return existing;
      const id = `rId${next++}`;
      byHref.set(href, id);
      return id;
    },
    elements(): string {
      return [...byHref.entries()]
        .map(
          ([href, id]) =>
            `<Relationship Id="${escapeXml(id)}" Type="${HYPERLINK_REL_TYPE}" Target="${escapeXml(href)}" TargetMode="External"/>`
        )
        .join('');
    },
    get size(): number {
      return byHref.size;
    },
  };
}

const EMPTY_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

/**
 * Produces a finished .docx by injecting `doc` into the user's template.
 *
 * The only mutations are word/document.xml and its rels file, and even in the
 * document the trailing <w:sectPr> is carried across verbatim - that block
 * holds the page size, the margins and the header and footer references, so
 * dropping it loses the logo and the page layout in one go.
 */
export async function injectIntoTemplate(
  templateBuffer: Buffer,
  doc: ResumeDoc,
  mapping: StyleMapping
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(templateBuffer);
  const documentFile = zip.file(DOCUMENT_PATH);
  if (!documentFile) {
    throw new Error('That template is not a valid .docx (no word/document.xml).');
  }

  const xml = await documentFile.async('string');

  const openTag = xml.match(/<w:body[^>]*>/);
  const closeIndex = xml.lastIndexOf('</w:body>');
  if (!openTag || openTag.index === undefined || closeIndex === -1) {
    throw new Error('That template is not a valid .docx (no <w:body>).');
  }

  const contentStart = openTag.index + openTag[0].length;
  const head = xml.slice(0, contentStart);
  const tail = xml.slice(closeIndex);
  const existingBody = xml.slice(contentStart, closeIndex);

  // The body-level section properties are always the last child of <w:body>,
  // after any mid-document section breaks nested inside paragraphs - so the
  // last occurrence is the one we want.
  const sectPrIndex = existingBody.lastIndexOf('<w:sectPr');
  const sectPr = sectPrIndex === -1 ? '' : existingBody.slice(sectPrIndex);

  const relsFile = zip.file(RELS_PATH);
  const existingRels = relsFile ? await relsFile.async('string') : EMPTY_RELS;

  const stylesFile = zip.file('word/styles.xml');
  const styles = stylesFile ? await stylesFile.async('string') : '';

  const links = createLinkTracker(existingRels, /w:styleId="Hyperlink"/.test(styles));

  // The tab stop that right-aligns a date is an absolute position, so it has
  // to come from THIS template's page size and margins rather than an assumed
  // Letter page.
  const rebuilt =
    head + buildBodyXml(doc, mapping, links, contentWidthTwips(xml)) + sectPr + tail;
  zip.file(DOCUMENT_PATH, rebuilt);

  if (links.size > 0) {
    const closing = existingRels.lastIndexOf('</Relationships>');
    if (closing === -1) {
      throw new Error('That template is not a valid .docx (malformed relationships).');
    }
    zip.file(
      RELS_PATH,
      existingRels.slice(0, closing) + links.elements() + existingRels.slice(closing)
    );
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
