// SERVER-SIDE ONLY - gets the user's base resume as a tagged document.
//
// Resumes uploaded before the tagged pipeline existed have `raw_text` but no
// `tagged_doc`, so one is produced on demand and written back. The user pays
// that cost once, on their next tailoring, instead of being told to re-upload.
//
// The subtlety is *what* gets tagged. The obvious choice - the stored
// `raw_text` - is the wrong one: it was produced by an extractor that threw
// hyperlink targets away, so tagging it would bake "LinkedIn" in as dead text
// permanently. So the original file is fetched back out of storage and
// re-extracted with the current reader, and the improved text is saved over
// the old `raw_text` while we are there (buildUserContext reads that column,
// and it was missing the same links).

import { readStoredDoc } from '@/lib/tagged/validate';
import { parseResumeFile, parseResumeText, type ParsedResume } from '@/lib/tagged/parseResume';
import { extractResumeText, isDocxFile } from '@/lib/docx/extractText';
import { downloadResumeFile } from '@/lib/docx/resumeFile';
import type { ResumeDoc } from '@/lib/tagged/schema';

/**
 * Which version of the parsing pipeline the stored document must have come
 * from to still be trusted. Bump this whenever a change would produce a
 * materially better document from the same file, and every user's resume
 * re-derives itself on their next tailoring instead of being left stale.
 *
 * Versions 1-11 were the bucketed format - experience[], education[],
 * skills[], custom[] - and the repair passes that existed to undo the model's
 * routing mistakes. 12 is the format that has no buckets: a resume is its own
 * ordered list of sections, so there is no wrong bucket to be in.
 *
 * 13 added the completeness check. Documents parsed before it may be quietly
 * missing a bullet the model dropped, and nothing about them looks wrong, so
 * they will never be re-parsed unless this forces it.
 *
 * 14 removed the last fixed slots. A section is now the lines the resume
 * printed, in order, and a .docx is read rather than transcribed - so every
 * line points back at its own paragraph and a download can write into the
 * user's own file. Nothing stored before this has those references, and until
 * it is re-derived its downloads are still rebuilt rather than rewritten.
 */

export const CURRENT_TAGGED_VERSION = 14;

/** The columns resolveBaseResume needs. */
export interface BaseResumeRow {
  id: string;
  raw_text: string | null;
  tagged_doc: unknown;
  tagged_version?: number | null;
  file_url: string | null;
  file_name: string | null;
}

/** Minimal shape of the Supabase client, so this file does not depend on one. */
interface ResumeUpdater {
  from(table: 'resumes'): {
    update(values: Record<string, unknown>): {
      eq(column: 'id', value: string): PromiseLike<unknown>;
    };
  };
}

export interface BaseResumeResult {
  doc: ResumeDoc;
  /** True when this call had to run the AI because no tagged document existed. */
  backfilled: boolean;
}

/**
 * Re-reads the original upload, falling back to the stored text.
 *
 * Returns null only when there is nothing readable at all - a resume whose
 * file has been removed from storage and whose text is empty.
 */
async function freshestText(row: BaseResumeRow): Promise<string | null> {
  if (row.file_url) {
    const buffer = await downloadResumeFile(row.file_url);
    if (buffer) {
      try {
        const text = await extractResumeText(
          buffer,
          isDocxFile(row.file_name ?? row.file_url, '')
        );
        if (text.trim().length >= 50) return text;
      } catch {
        // An unreadable file is not fatal while stored text still exists.
      }
    }
  }
  return row.raw_text?.trim() ? row.raw_text : null;
}

/**
 * Re-derives the document from the original file when it is still there.
 *
 * The file is strongly preferred over the stored text for a .docx, because the
 * file has structure and the text does not: reading it gives every line a
 * reference back to its own paragraph, which is what lets a download write the
 * tailored words into the user's document instead of a rebuilt copy of it.
 */
async function parseFromFile(row: BaseResumeRow): Promise<ParsedResume | null> {
  if (!row.file_url) return null;
  const buffer = await downloadResumeFile(row.file_url);
  if (!buffer) return null;

  try {
    return await parseResumeFile(buffer, isDocxFile(row.file_name ?? row.file_url, ''));
  } catch {
    // Unreadable file, still-usable stored text. The caller falls back.
    return null;
  }
}

/**
 * The base resume as a tagged document, tagging it first if necessary.
 *
 * Throws when the resume cannot be read at all; callers turn that into a
 * message telling the user to re-upload.
 */
export async function resolveBaseResume(
  row: BaseResumeRow,
  supabase: ResumeUpdater
): Promise<BaseResumeResult> {
  // A document produced by an older pipeline is treated exactly like a missing
  // one. That is the point: it means an improvement to parsing reaches every
  // existing user automatically, rather than only the ones who happen to
  // re-upload their resume.
  const stored = readStoredDoc(row.tagged_doc);
  if (stored && (row.tagged_version ?? 0) >= CURRENT_TAGGED_VERSION) {
    return { doc: stored, backfilled: false };
  }

  const fromFile = await parseFromFile(row);

  let doc: ResumeDoc;
  let text: string;

  if (fromFile) {
    doc = fromFile.doc;
    text = fromFile.text;
  } else {
    const stale = await freshestText(row);
    if (!stale) throw new Error('Could not read your base resume. Try re-uploading it.');
    text = stale;
    doc = (await parseResumeText(stale)).doc;
  }

  await supabase
    .from('resumes')
    .update({ tagged_doc: doc, tagged_version: CURRENT_TAGGED_VERSION, raw_text: text })
    .eq('id', row.id);

  return { doc, backfilled: true };
}
