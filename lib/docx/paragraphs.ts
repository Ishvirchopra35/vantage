// Reads a .docx's own paragraph structure.
//
// This is the file that makes "the user's document is the structure" true
// rather than aspirational. A .docx already states, exactly and unambiguously,
// what lines the resume has, what order they are in, which ones are bullets and
// where the tabs fall. None of that has to be inferred, and none of it has to
// be asked of a model - it is sitting in word/document.xml.
//
// So for a Word upload nothing about the layout is ever decided by us. We read
// the paragraphs, we change the words in the ones being tailored, and we write
// the file back with every other byte where it was. A bullet cannot go missing
// because nobody is retyping it; a date cannot move off its line because nobody
// is deciding which line it belongs on.

/** One paragraph of the source document, in document order. */
export interface SourceParagraph {
  /** Position in the body. This is the identity everything else refers to. */
  index: number;
  /** The paragraph's own XML, verbatim, for writing back unchanged. */
  xml: string;
  /** The visible text, with tabs preserved as tabs. */
  text: string;
  /** True when Word prints this paragraph as a list item. */
  bullet: boolean;
}

// A paragraph is <w:p>...</w:p> or the empty <w:p/>. Paragraphs nested inside a
// text box match too, and that is fine: this list is the only index space in
// use, and the writer walks the same list, so it stays self-consistent.
const PARAGRAPH = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g;

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function decode(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m] ?? m);
}

/**
 * The text of one paragraph.
 *
 * <w:tab/> becomes a real tab and <w:br/> a newline, because both are content:
 * the tab is how the resume right-aligns its dates, and losing it is what moved
 * every date onto the wrong line.
 */
export function paragraphText(xml: string): string {
  let out = '';
  for (const match of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)) {
    if (match[1] !== undefined) out += decode(match[1]);
    else if (match[0] === '<w:tab/>') out += '\t';
    else out += '\n';
  }
  return out;
}

/** True when Word numbers or bullets this paragraph. */
export function isBulletParagraph(xml: string): boolean {
  const properties = xml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  return properties ? /<w:numPr>/.test(properties[0]) : false;
}

/** The body's XML: everything between <w:body> and its trailing <w:sectPr>. */
export interface DocumentBody {
  /** Everything before the body's content, including the <w:body> tag. */
  head: string;
  /** The body content, paragraphs and all. */
  content: string;
  /** The trailing <w:sectPr> - page size, margins, header and footer refs. */
  sectPr: string;
  /** Everything from </w:body> onwards. */
  tail: string;
}

/** Splits document.xml into the parts a rewrite needs. Throws if malformed. */
export function splitBody(xml: string): DocumentBody {
  const open = xml.match(/<w:body[^>]*>/);
  const close = xml.lastIndexOf('</w:body>');
  if (!open || open.index === undefined || close === -1) {
    throw new Error('That file is not a valid .docx (no <w:body>).');
  }

  const start = open.index + open[0].length;
  const body = xml.slice(start, close);

  // The body-level section properties are always the last child of <w:body>,
  // after any mid-document section breaks nested inside paragraphs - so the
  // last occurrence is the one we want.
  const sectPrIndex = body.lastIndexOf('<w:sectPr');

  return {
    head: xml.slice(0, start),
    content: sectPrIndex === -1 ? body : body.slice(0, sectPrIndex),
    sectPr: sectPrIndex === -1 ? '' : body.slice(sectPrIndex),
    tail: xml.slice(close),
  };
}

/**
 * Every paragraph of a document, in order.
 *
 * Paragraphs with no visible text are kept. They are spacers, images and page
 * furniture, and dropping them would change the layout of a document we are
 * meant to be preserving byte for byte.
 */
export function readParagraphs(documentXml: string): SourceParagraph[] {
  const { content } = splitBody(documentXml);
  const paragraphs: SourceParagraph[] = [];

  for (const match of content.matchAll(PARAGRAPH)) {
    paragraphs.push({
      index: paragraphs.length,
      xml: match[0],
      text: paragraphText(match[0]),
      bullet: isBulletParagraph(match[0]),
    });
  }

  return paragraphs;
}
