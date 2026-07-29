// SERVER-SIDE ONLY - picks how a .docx download gets built.
//
// Three strategies, in descending order of how much of the user's own document
// survives:
//
//   1. Rewrite. The resume was uploaded as Word and every line still knows
//      which paragraph of that file it came from, so the file is reopened and
//      only the words that changed are changed. Nothing is recreated, so
//      nothing can drift: their fonts, spacing, tab stops, bold spans, list
//      numbering, headers, footers and hyperlinks are all still literally
//      theirs. This is the path almost every Word user takes.
//
//   2. Inject. There is a Word file to work from but it is not the one this
//      document was read out of - a template uploaded separately on the profile
//      page. Paragraphs have to be built, and they claim the template's own
//      styles so the result still reads in its design.
//
//   3. Build. No Word file at all, because the resume came in as a PDF. The
//      built-in layout applies.

import { injectIntoTemplate } from './inject';
import { buildFallbackDocx } from './fallback';
import { rewriteDocx } from './rewrite';
import { resolveTemplate, type TemplateSources } from './resolveTemplate';
import { normaliseSection, type ResumeDoc } from '@/lib/tagged/schema';

/** True when this document's lines point back at paragraphs of a Word file. */
export function hasSourceParagraphs(doc: ResumeDoc): boolean {
  return doc.sections
    .map(normaliseSection)
    .some((section) => section.blocks.some((block) => block.source !== undefined));
}

export interface BuiltDocx {
  buffer: Buffer;
  /** Which strategy produced it, for logging and for what the UI can claim. */
  strategy: 'rewrite' | 'inject' | 'built-in';
}

/**
 * The finished .docx.
 *
 * A template that turns out to be unusable degrades to the next strategy rather
 * than failing the download - the user still gets their resume, just with less
 * of their own design in it.
 */
export async function buildResumeDocx(
  doc: ResumeDoc,
  sources: TemplateSources
): Promise<BuiltDocx> {
  const template = await resolveTemplate(sources);

  if (template?.source === 'base-resume' && hasSourceParagraphs(doc)) {
    try {
      return { buffer: await rewriteDocx(template.buffer, doc), strategy: 'rewrite' };
    } catch {
      // Falls through to injection, which rebuilds the paragraphs but still
      // uses the file's styles.
    }
  }

  if (template) {
    return {
      buffer: await injectIntoTemplate(template.buffer, doc, template.mapping),
      strategy: 'inject',
    };
  }

  return { buffer: await buildFallbackDocx(doc), strategy: 'built-in' };
}
