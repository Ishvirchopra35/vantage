// SERVER-SIDE ONLY - storage and introspection for a user's Word template.
//
// The template is the .docx whose look the user wants their resume to keep:
// their fonts, spacing, header, footer and margins. We store the file itself in
// the private `resumes` bucket under `${userId}/templates/`, which the existing
// storage policies already scope to its owner, and store the style mapping on
// the profile row.
//
// The service-role client is used deliberately: template reads happen inside
// download routes that have already authenticated the user and know exactly
// whose template they are asking for, and a signed-URL round trip per download
// would be latency for nothing.

import { createClient as createServiceClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { STYLE_SLOTS, type StyleMapping, type StyleSlot } from '@/lib/tagged/schema';
import { downloadResumeFile } from './resumeFile';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'resumes';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** A paragraph style offered by the user's template. */
export interface TemplateStyle {
  /** What `<w:pStyle w:val="...">` must contain. */
  styleId: string;
  /** What Word shows the user in the Styles pane. */
  name: string;
}

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase service credentials');
  return createServiceClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

// -- storage ------------------------------------------------------------------

/** One template per user, at a fixed path, so replacing simply overwrites. */
export function templatePath(userId: string): string {
  return `${userId}/templates/template.docx`;
}

export async function saveTemplate(userId: string, buffer: Buffer): Promise<string> {
  const path = templatePath(userId);
  const { error } = await serviceClient()
    .storage.from(BUCKET)
    .upload(path, buffer, { contentType: DOCX_MIME, upsert: true });

  if (error) throw new Error(error.message);
  return path;
}

/** The stored template, or null when the user has not uploaded one. */
export async function loadTemplate(path: string): Promise<Buffer | null> {
  return downloadResumeFile(path);
}

export async function deleteTemplate(path: string): Promise<void> {
  await serviceClient().storage.from(BUCKET).remove([path]);
}

// -- introspection ------------------------------------------------------------

/**
 * Lists the paragraph styles defined in a .docx.
 *
 * The styleId/name distinction matters more than it looks: Word's UI shows
 * `<w:name>` ("Resume Bullet") while the XML that applies a style needs
 * `<w:styleId>` ("ResumeBullet"). Mapping on the display name and writing the
 * id is the single most common way to get a silently unstyled document.
 */
export async function readTemplateStyles(buffer: Buffer): Promise<TemplateStyle[]> {
  const zip = await JSZip.loadAsync(buffer);
  const stylesFile = zip.file('word/styles.xml');
  if (!stylesFile) throw new Error('That .docx has no styles.xml - is it a valid Word file?');

  const xml = await stylesFile.async('string');
  const styles: TemplateStyle[] = [];

  for (const match of xml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const [, attrs, body] = match;
    if (!/w:type="paragraph"/.test(attrs)) continue;

    const idMatch = attrs.match(/w:styleId="([^"]+)"/);
    if (!idMatch) continue;

    const nameMatch = body.match(/<w:name w:val="([^"]*)"\s*\/?>/);
    styles.push({ styleId: idMatch[1], name: nameMatch?.[1] || idMatch[1] });
  }

  return styles.sort((a, b) => a.name.localeCompare(b.name));
}

// -- default mapping ----------------------------------------------------------

/** Lowercased, punctuation-free form used for fuzzy style matching. */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Style names to look for, per slot. Deliberately only names that were chosen
 * on purpose - "Resume Bullet", "Contact Line", "Section Heading".
 *
 * Word's own built-ins are NOT listed, and that is the important part. Every
 * .docx declares Heading1-6, Title, Subtitle and ListParagraph whether or not
 * the author ever used them, so matching against those meant a resume with no
 * deliberate styling still "found" a style for half its slots - and Heading1
 * is 16pt blue Calibri Light, which looks nothing like the small bold section
 * heading the resume actually used.
 *
 * Matching only intentional names means a personal resume matches almost
 * nothing and falls through to SLOT_FORMATS, which is designed to look like a
 * resume. A template that really was built with named styles still matches and
 * is followed exactly.
 */
const SLOT_HINTS: Record<StyleSlot, string[]> = {
  name: ['candidatename', 'resumename', 'applicantname'],
  contact: ['contactline', 'contact', 'contactinfo', 'contactdetails'],
  sectionHeading: ['sectionheading', 'sectiontitle', 'resumeheading', 'resumesection'],
  entryLine: ['company', 'employer', 'organisation', 'organization', 'projecttitle', 'school'],
  line: ['profile', 'summary', 'skills', 'skillsline', 'professionalsummary'],
  bullet: ['resumebullet', 'bulletpoint', 'experiencebullet'],
};

/**
 * Best-effort slot-to-style map for a freshly uploaded template.
 *
 * Scrubbed had a recruiter confirm every slot in a mapping table; Vantage does
 * not, so this runs unattended and its fallbacks matter more. An unmapped slot
 * is not an error - buildBodyXml omits <w:pStyle> and the paragraph inherits
 * the template's Normal style, which is plain but never broken.
 */
export function suggestMapping(styles: TemplateStyle[]): StyleMapping {
  const byNormalisedName = new Map<string, string>();
  for (const style of styles) {
    // First writer wins, so a real style beats a same-named latent one.
    for (const key of [normalise(style.name), normalise(style.styleId)]) {
      if (!byNormalisedName.has(key)) byNormalisedName.set(key, style.styleId);
    }
  }

  const mapping: StyleMapping = {};
  for (const slot of STYLE_SLOTS) {
    for (const hint of SLOT_HINTS[slot.key]) {
      const found = byNormalisedName.get(hint);
      if (found) {
        mapping[slot.key] = found;
        break;
      }
    }
  }
  return mapping;
}
