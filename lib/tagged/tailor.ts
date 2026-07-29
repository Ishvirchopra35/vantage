// SERVER-SIDE ONLY - rewrites a resume's bullets to match a job.
//
// The AI is handed the tagged document and told to rewrite text in place. It
// is NOT trusted to have done so. Three checks stand between the model and the
// user's resume:
//
//   1. assertSameSkeleton - the tag sequence must be identical, so the number
//      of sections, entries and bullets, and their order, cannot change.
//   2. lockFields         - everything that is not a bullet is restored from
//      the original, so a heading, an employer or a date cannot drift even
//      though the skeleton allows it.
//   3. clampBulletLengths - a rewritten bullet that grew materially longer is
//      reverted, because a bullet that wraps onto a second line is how a
//      one-page resume silently becomes two.
//
// If the model cannot keep the skeleton across two attempts, the original is
// returned untouched. An untailored resume is worse than a tailored one, and
// far better than a broken one.

import * as Sentry from '@sentry/nextjs';
import { docToTagged, taggedToDoc } from '@/lib/tagged/serialize';
import { assertSameSkeleton } from '@/lib/tagged/skeleton';
import { normaliseSection, type ResumeDoc } from '@/lib/tagged/schema';
import { generateText } from '@/lib/ai';

const MAX_TOKENS = 8000;

/**
 * How much longer a rewritten bullet may be than the original before it is
 * rejected. Some growth is legitimate - naming a technology costs characters -
 * but past roughly a sixth the bullet starts wrapping.
 */
const LENGTH_TOLERANCE = 1.15;

/** What the tailoring is aiming at. Mirrors the columns /api/parse-job fills. */
export interface TailorTarget {
  title: string;
  company: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  keyResponsibilities: string[];
  keywords: string[];
}

// -- prompt -------------------------------------------------------------------

const SYSTEM_PROMPT = `You tailor resumes to job descriptions. You rewrite ONLY the text inside <bullet> tags.

ABSOLUTE RULE: the tag structure of your output must be identical to the input. Same tags, same order, same count. Never add, remove, reorder or rename a tag. Never add or delete a <bullet>, a <line> or a <section>.

YOU MAY ONLY CHANGE THE TEXT INSIDE <bullet> TAGS.

EVERY OTHER TAG IS REPRODUCED CHARACTER FOR CHARACTER: <name>, <contact>, <heading>, <line>. Copy them exactly as given, including punctuation and capitalisation. A <heading> is what the candidate calls that section and is never reworded. A <line> is an employer, a job title, a degree, a date, a skills list or a summary - never reworded, never reordered, never merged.

Some text contains "\\t". That is a tab the resume uses to push what follows it to the right margin, usually a date. Reproduce it exactly where it appears. Never add one, never remove one, never turn it into spaces.

YOUR GOAL: re-frame each relevant bullet so it speaks the job description's language. Whenever a bullet describes work that touches a required skill, responsibility or keyword from the job, rewrite it to NAME that thing using the job's exact terminology. Example: if the job lists React, Node.js, PostgreSQL and Jest, a bullet about building a web feature should say React/Node.js, a bullet about databases should say PostgreSQL - provided the original bullet is genuinely about that work.

WHAT COUNTS AS A CHANGE - a rewritten bullet must do at least one of:
(a) weave in a required skill, responsibility phrase or keyword from the job,
(b) re-frame the bullet toward the job's domain or seniority language, or
(c) restructure the bullet to front-load the result or metric the job values.
NOT a change: shortening the wording, deleting articles, or swapping one generic verb for another ("Built" -> "Developed"). If the best you can do is trim words, RETURN THE BULLET UNCHANGED. It is normal and correct to leave most bullets exactly as they are.

RULES FOR EVERY BULLET YOU REWRITE:
1. NEVER add experience, skills or facts not in the original resume. Only name a technology if the original bullet's work plausibly involved it.
2. Preserve ALL numbers, percentages, dollar amounts and metrics verbatim - "45s to 38s", "$45K+", "99%" must appear exactly as written.
3. Keep the rewritten bullet no longer than the original, and never longer than 25 words. A bullet that grows pushes the resume onto a second page.
4. Keep the original's direct tone. Never add filler like "demonstrating my ability to" or "leveraging my expertise in".
5. Max 2 job keywords per bullet. Never force a keyword into a bullet about unrelated work.

Output ONLY the tagged document, starting with <resume> and ending with </resume>. No code fences, no commentary.`;

function userPrompt(tagged: string, target: TailorTarget, userContext: string): string {
  return `${userContext}

TARGET JOB:
Title: ${target.title} at ${target.company}
Required skills: ${target.requiredSkills.join(', ')}
Nice to have: ${target.niceToHaveSkills.join(', ')}
Key responsibilities:
- ${target.keyResponsibilities.join('\n- ')}
Keywords to weave in naturally: ${target.keywords.slice(0, 30).join(', ')}

TAGGED RESUME:
${tagged}`;
}

// -- deterministic guards -----------------------------------------------------

/**
 * Restores everything the model was not allowed to touch.
 *
 * assertSameSkeleton proves the document's shape survived; this proves the
 * content of everything that is not a bullet survived too. Both are needed:
 * the skeleton is blind to text, so a model that renamed the candidate's
 * employer would sail straight through it.
 *
 * One rule covers the whole document now - bullets may change, nothing else
 * may. Under the old bucketed shape this needed a clause per section type, and
 * a new section type meant remembering to add another.
 *
 * Safe to index positionally because it only runs after the skeleton check,
 * which guarantees matching array lengths.
 */
export function lockFields(before: ResumeDoc, after: ResumeDoc): ResumeDoc {
  return {
    ...before,
    name: before.name,
    contact: before.contact,
    sections: before.sections.map((rawBefore, sectionIndex) => {
      const original = normaliseSection(rawBefore);
      const tailored = normaliseSection(after.sections[sectionIndex]);

      return {
        ...original,
        heading: original.heading,
        blocks: original.blocks.map((block, blockIndex) => ({
          ...block,
          // A bullet may take the model's wording. Every other line keeps its
          // own, and every line keeps its `source` - the paragraph of the
          // user's file it will be written back into. A model that renumbered
          // those could redirect a bullet into someone's job title.
          text: block.bullet ? tailored.blocks[blockIndex]?.text || block.text : block.text,
        })),
      };
    }),
  };
}

/**
 * Reverts any bullet that grew materially longer than the original.
 *
 * This is the one-page guard. The template's page size, margins and styles
 * come through untouched, so the only thing that can push a one-page resume
 * onto a second page is text getting longer and wrapping.
 */
export function clampBulletLengths(before: ResumeDoc, after: ResumeDoc): ResumeDoc {
  return {
    ...after,
    sections: after.sections.map((rawSection, sectionIndex) => {
      const original = normaliseSection(before.sections[sectionIndex]);
      const tailored = normaliseSection(rawSection);

      return {
        ...tailored,
        blocks: tailored.blocks.map((block, blockIndex) => {
          const source = original.blocks[blockIndex]?.text;
          if (!block.bullet || source === undefined) return block;
          const tooLong = block.text.length > Math.ceil(source.length * LENGTH_TOLERANCE);
          return tooLong ? { ...block, text: source } : block;
        }),
      };
    }),
  };
}

// -- the diff -----------------------------------------------------------------

/** One rewritten bullet, in the shape components/TailorDiff.tsx renders. */
export interface TailorChange {
  section: string;
  entry: string;
  original: string;
  tailored: string;
  reason: string;
}

const FILLER_WORDS = new Set([
  'a', 'an', 'the', 'and', 'with', 'using', 'to', 'of', 'for', 'in', 'on',
]);
const INTERCHANGEABLE_VERBS = new Map<string, string>([
  ['built', 'made'], ['developed', 'made'], ['created', 'made'], ['made', 'made'],
  ['implemented', 'made'], ['constructed', 'made'], ['engineered', 'made'],
]);

/**
 * True when a rewrite achieved nothing a reader would notice - dropped
 * articles, a swapped generic verb. Those are noise in the diff view, so they
 * are reported as unchanged even though the characters differ.
 */
function isTrivialChange(original: string, tailored: string): boolean {
  const normalize = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s%$.+~-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !FILLER_WORDS.has(w))
      .map((w) => INTERCHANGEABLE_VERBS.get(w) ?? w)
      .join(' ');

  return normalize(original) === normalize(tailored);
}

/**
 * Names the job terms a rewrite actually introduced.
 *
 * Computed from the two texts rather than asked of the model, so the reason is
 * always true by construction.
 */
function describeChange(original: string, tailored: string, target: TailorTarget): string {
  const terms = [
    ...target.requiredSkills,
    ...target.niceToHaveSkills,
    ...target.keywords,
  ].filter((t) => typeof t === 'string' && t.trim().length > 1);

  // Bounded on both sides so "React" is not found inside "Reactor", with a
  // trailing "s" allowed so a job asking for a "data pipeline" is credited
  // when the bullet says "data pipelines". Custom boundaries rather than \b
  // because \b treats "+", "#" and "." as separators.
  const has = (text: string, term: string): boolean =>
    new RegExp(
      `(?<![\\w+#.-])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(?![\\w+#-])`,
      'i'
    ).test(text);

  const added: string[] = [];
  for (const term of terms) {
    if (added.length === 3) break;
    if (!has(original, term) && has(tailored, term) && !added.includes(term)) added.push(term);
  }

  if (added.length > 0) return `Added ${added.join(', ')} from the job description`;
  return 'Re-framed toward the job description';
}

/** Required skills the resume never mentions. */
export function findSkillGaps(doc: ResumeDoc, target: TailorTarget): string[] {
  const haystack = doc.sections
    .map(normaliseSection)
    .flatMap((section) => [section.heading, ...section.blocks.map((block) => block.text)])
    .join('\n')
    .toLowerCase();

  return target.requiredSkills
    .filter((skill) => typeof skill === 'string' && skill.trim().length > 1)
    .filter((skill) => !haystack.includes(skill.trim().toLowerCase()))
    .slice(0, 20);
}

/**
 * Pairs every bullet before and after tailoring and reports the ones that
 * moved.
 *
 * Positional pairing is sound because assertSameSkeleton already ran: the two
 * documents have the same sections in the same order with the same bullet
 * counts.
 */
export function diffBullets(
  before: ResumeDoc,
  after: ResumeDoc,
  target: TailorTarget
): TailorChange[] {
  const changes: TailorChange[] = [];

  after.sections.forEach((rawSection, sectionIndex) => {
    const original = normaliseSection(before.sections[sectionIndex]);
    const tailored = normaliseSection(rawSection);
    const heading = tailored.heading || 'Resume';

    // The line a bullet sits under is the entry it belongs to - an employer, a
    // project - which is what the diff view labels each change with. Tracked
    // while walking rather than stored, because it is a fact about position.
    let entry = '';

    tailored.blocks.forEach((block, blockIndex) => {
      if (!block.bullet) {
        entry = block.text.trim();
        return;
      }

      const source = (original.blocks[blockIndex]?.text ?? '').trim();
      const result = block.text.trim();
      if (!source || !result || source === result || isTrivialChange(source, result)) return;

      changes.push({
        section: heading,
        entry,
        original: source,
        tailored: result,
        reason: describeChange(source, result, target),
      });
    });
  });

  return changes.slice(0, 60);
}

// -- public API ---------------------------------------------------------------

export interface TailorResult {
  doc: ResumeDoc;
  tagged: string;
  /** True when both AI attempts drifted and the original was returned as-is. */
  usedFallback: boolean;
}

/**
 * Tailors a tagged resume to a job. `userContext` is the block from
 * formatContextForPrompt() - the candidate's history is what stops the model
 * inventing a technology they have never touched.
 */
export async function tailorTagged(
  original: ResumeDoc,
  target: TailorTarget,
  userContext: string
): Promise<TailorResult> {
  // Takes the document, not its tagged string, and that distinction matters.
  // The tagged format carries text only - a block's `source`, the paragraph of
  // the user's .docx it will be written back into, is deliberately never shown
  // to the model. Re-parsing the string to get the "original" therefore hands
  // lockFields a document with no paragraph references to restore, and the
  // download silently falls back to rebuilding the resume instead of editing
  // the user's own file. Nothing looks broken; the formatting is just quietly
  // ours again.
  const tagged = docToTagged(original);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateText(
        SYSTEM_PROMPT,
        attempt === 0
          ? userPrompt(tagged, target, userContext)
          : `Your previous attempt changed the tag structure, which is forbidden. Reproduce the tags EXACTLY as given and change only the text inside <bullet>.\n\n${userPrompt(tagged, target, userContext)}`,
        MAX_TOKENS
      );

      // Round-trip through our own parser first so the comparison is against
      // normalised output, not the model's whitespace habits.
      const parsed = taggedToDoc(raw);
      const normalised = docToTagged(parsed);
      assertSameSkeleton(tagged, normalised);

      const doc = clampBulletLengths(original, lockFields(original, parsed));
      return { doc, tagged: docToTagged(doc), usedFallback: false };
    } catch (e) {
      // Reported rather than swallowed: silently handing back an untailored
      // resume is the kind of quality drop that goes unnoticed for weeks. The
      // static message groups every occurrence into one alertable issue.
      Sentry.captureMessage('Tailoring attempt rejected - AI altered resume structure', {
        level: attempt === 0 ? 'info' : 'warning',
        extra: { attempt: attempt + 1, reason: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  Sentry.captureMessage('Tailoring fell back to the untailored resume', 'error');
  return { doc: original, tagged: docToTagged(original), usedFallback: true };
}
