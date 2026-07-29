// SERVER-SIDE ONLY - raw text extraction from an uploaded resume file.
//
// Both parsers are pulled in with dynamic import() rather than a top-level
// import so a Word upload never loads the PDF stack (pdf-parse drags in
// pdfjs-dist and the native @napi-rs/canvas binding) and vice versa. Both are
// listed in serverExternalPackages so they run as real Node modules.
//
// Links get special handling. A resume's LinkedIn or portfolio address is
// usually a *hyperlink*: the visible words are "LinkedIn" and the actual
// address is hidden behind them. Plain text extraction keeps the words and
// throws the address away, so the candidate's portfolio silently vanishes.
// Both paths below recover the address and write it into the text, because
// the AI can only tag what it can see.

import JSZip from 'jszip';
import { readParagraphs, type SourceParagraph } from './paragraphs';

// Re-exported so server callers keep one import for reading a resume file. Its
// definition lives in fileType.ts because the browser needs it and this module
// pulls in a zip library.
export { isDocxFile } from './fileType';

/**
 * Renders a hyperlink as readable text.
 *
 * When the visible words already are the address ("linkedin.com/in/jane"),
 * printing both would just duplicate it. When they differ ("Portfolio" ->
 * "janedoe.com"), both are kept so no information is lost.
 */
function flattenLink(text: string, url: string): string {
  const label = text.trim();
  const href = url.trim().replace(/^mailto:/i, '');
  if (!href) return label;
  if (!label) return href;

  const bare = href.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (label === href || label === bare || bare.includes(label)) return bare;
  return `${label} (${bare})`;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/**
 * Converts mammoth's HTML into plain text, keeping hyperlink addresses and
 * turning list items into bullet lines so the AI can still see which
 * paragraphs were bullets.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) =>
      flattenLink(inner.replace(/<[^>]+>/g, ''), href)
    )
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    // Runs of spaces collapse; tabs do NOT. A tab is how a resume right-aligns
    // the date at the end of a line, and it is the only surviving record that
    // the date belonged on that line at all. Folding it into a space is what
    // moved every date onto a line of its own.
    .replace(/ +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Rewrites pdf-parse's markdown-style links, e.g. [Portfolio](https://x.com). */
function flattenMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_, label: string, href: string) =>
    flattenLink(label, href)
  );
}

/**
 * The paragraphs of a Word resume, or null when the file is not one we can
 * read that way.
 *
 * This is the preferred path for a .docx and the reason a Word upload cannot
 * lose a bullet: the file already states every line, its order and whether it
 * is a bullet, so none of that has to be transcribed by a model. Callers fall
 * back to extractResumeText only when this returns null.
 */
export async function extractDocxParagraphs(buffer: Buffer): Promise<SourceParagraph[] | null> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const documentFile = zip.file('word/document.xml');
    if (!documentFile) return null;

    const paragraphs = readParagraphs(await documentFile.async('string'));
    return paragraphs.some((p) => p.text.trim()) ? paragraphs : null;
  } catch {
    // A .doc renamed to .docx, or an archive we cannot open. Not fatal: the
    // text path below still gets a resume out of most of them.
    return null;
  }
}

/**
 * Extracts plain text from a resume file buffer. Throws on unparseable
 * files - callers decide how to surface that.
 */
export async function extractResumeText(buffer: Buffer, docx: boolean): Promise<string> {
  if (docx) {
    const mammoth = await import('mammoth');
    // convertToHtml rather than extractRawText: raw text discards hyperlink
    // targets and list markers, both of which we want.
    const { value } = await mammoth.convertToHtml({ buffer });
    const text = htmlToText(value);
    if (text.trim()) return text;

    // Fall back to raw extraction if the HTML conversion produced nothing
    // useful - better a resume with no links than no resume.
    const raw = await mammoth.extractRawText({ buffer });
    return raw.value;
  }

  // pdf-parse v2 is a ground-up rewrite of the old 1.x package: it exports a
  // PDFParse class instead of a single function, and the `lib/pdf-parse.js`
  // deep-import workaround that 1.x needed no longer exists.
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    // parseHyperlinks pulls URLs out of the PDF's link annotations, which are
    // stored separately from the text and are otherwise invisible.
    const result = await parser.getText({ parseHyperlinks: true });
    return flattenMarkdownLinks(result.text);
  } finally {
    // Releases the underlying pdf.js document; skipping this leaks memory
    // across uploads because the worker holds the whole file.
    await parser.destroy();
  }
}
