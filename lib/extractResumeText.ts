// SERVER-SIDE ONLY - raw text extraction from uploaded resume files.
// Shared by /api/parse-resume (base resume upload) and /api/resume-studio
// (experimental editor) so both accept the same formats.

type PdfResult = { text: string; numpages: number };

/** True when the file should be parsed as Word rather than PDF. */
export function isDocxFile(fileName: string, contentType: string): boolean {
  return (
    /\.docx?$/i.test(fileName) ||
    contentType.includes('officedocument') ||
    contentType.includes('msword')
  );
}

/**
 * Extracts plain text from a resume file buffer. Throws on unparseable
 * files - callers decide how to surface that.
 */
export async function extractResumeText(buffer: Buffer, docx: boolean): Promise<string> {
  if (docx) {
    // require() instead of import: mammoth's ESM entry breaks under the
    // Next server runtime bundler.
    const mammoth = require('mammoth') as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  // pdf-parse's index.js runs debug code when imported directly; the inner
  // module is the real parser.
  const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buffer: Buffer) => Promise<PdfResult>;
  const pdfData = await pdfParse(buffer);
  return pdfData.text;
}

/**
 * Extracts hyperlink destinations from a resume file. PDFs store links as
 * page annotations that plain-text extraction drops entirely - this walks
 * them via pdf-parse's vendored pdf.js build. DOCX links come from mammoth's
 * HTML conversion. Fail-soft: any parse trouble returns an empty list.
 */
export async function extractResumeLinks(buffer: Buffer, docx: boolean): Promise<string[]> {
  const links = new Set<string>();
  try {
    if (docx) {
      const mammoth = require('mammoth') as {
        convertToHtml: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
      };
      const { value } = await mammoth.convertToHtml({ buffer });
      for (const match of value.matchAll(/href="([^"]+)"/g)) {
        links.add(match[1]);
      }
    } else {
      // Same pdf.js build pdf-parse itself uses; its types are not published,
      // so the module comes in untyped (any) by necessity.
      const pdfjs = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js') as any;
      pdfjs.disableWorker = true;
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) });
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const annotations = (await page.getAnnotations()) as Array<{ url?: unknown }>;
        for (const annotation of annotations) {
          if (typeof annotation?.url === 'string') links.add(annotation.url);
        }
      }
    }
  } catch {
    // Links are an enhancement, never a blocker.
  }
  return [...links]
    .map((l) => l.trim())
    .filter((l) => /^(https?:\/\/|mailto:)/i.test(l) && l.length <= 500)
    .slice(0, 30);
}
