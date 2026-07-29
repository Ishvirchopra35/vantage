// SERVER-SIDE ONLY - decides which .docx a download should be built from.
//
// Three sources, in order of how well they represent what the user wants their
// resume to look like:
//
//   1. A template they uploaded on purpose.
//   2. Their base resume, if it is a .docx. This is the good default almost
//      nobody will think to configure: the resume they already use IS the
//      design they already like, so their fonts, margins, header and spacing
//      come through without them doing anything.
//   3. The Vantage default layout, built from scratch.
//
// A PDF base resume cannot be a template - there are no Word styles inside a
// PDF to reference - so those users fall through to (3) until they upload a
// .docx.

import { loadTemplate, readTemplateStyles, suggestMapping } from './template';
import { downloadResumeFile } from './resumeFile';
import { isDocxFile } from './extractText';
import type { StyleMapping } from '@/lib/tagged/schema';

export interface ResolvedTemplate {
  buffer: Buffer;
  mapping: StyleMapping;
  /** Which of the three sources this came from, for the UI to explain. */
  source: 'template' | 'base-resume';
}

export interface TemplateSources {
  /** profiles.resume_template_path */
  templatePath?: string | null;
  /** profiles.resume_template_mapping */
  templateMapping?: StyleMapping | null;
  /** resumes.file_url of the base resume */
  baseResumePath?: string | null;
  /** resumes.file_name of the base resume */
  baseResumeName?: string | null;
}

/**
 * The best available template, or null to use the built-in layout.
 *
 * Never throws: every failure here has a working fallback, and a broken
 * template should degrade a download's styling rather than break it.
 */
/**
 * Reads the style mapping straight off the file rather than trusting a stored
 * one.
 *
 * Deriving it per download costs one zip entry read and means an improvement
 * to the matching rules takes effect for everyone immediately. A stored
 * mapping would keep pointing at whatever the rules said on the day it was
 * uploaded - including, before this, at Word's built-in Heading styles.
 */
async function mappingFor(buffer: Buffer): Promise<StyleMapping> {
  try {
    return suggestMapping(await readTemplateStyles(buffer));
  } catch {
    // Unreadable styles are not fatal: an empty mapping means every slot uses
    // its own fallback formatting, which is a working document.
    return {};
  }
}

export async function resolveTemplate(sources: TemplateSources): Promise<ResolvedTemplate | null> {
  if (sources.templatePath) {
    const buffer = await loadTemplate(sources.templatePath);
    if (buffer) {
      return { buffer, mapping: await mappingFor(buffer), source: 'template' };
    }
  }

  const basePath = sources.baseResumePath;
  if (basePath && isDocxFile(sources.baseResumeName ?? basePath, '')) {
    const buffer = await downloadResumeFile(basePath);
    if (buffer) {
      try {
        // Read once here purely to prove the file is a real .docx before
        // committing to it; a .doc renamed to .docx fails at this point and
        // falls through to the built-in layout instead of at download time.
        await readTemplateStyles(buffer);
        return { buffer, mapping: await mappingFor(buffer), source: 'base-resume' };
      } catch {
        // Not a readable .docx after all - fall through to the default.
      }
    }
  }

  return null;
}
