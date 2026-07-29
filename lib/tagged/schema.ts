// The canonical resume format.
//
// A resume is a name, a contact line, and an ordered list of sections. A
// section is a heading and the lines printed under it, in order. That is all.
//
// There are no fixed slots anywhere, and that is the whole design. Two earlier
// versions of this file had them and both failed the same way:
//
//   - Named section buckets (experience[], education[], skills[], custom[]).
//     Content the buckets could not hold had to be improvised somewhere, and
//     six repair passes existed to detect and undo the improvisations.
//
//   - Named line slots inside an entry (title, subtitle, meta). A resume that
//     printed "Employer | Job Title | Location<TAB>Dates" on ONE line had to be
//     split across three, so the date moved to a line it was never on. A skills
//     section printed as two paragraphs had one `text` field to land in, so the
//     second paragraph was silently dropped.
//
// Both were the same mistake: deciding in advance what shape a resume has. A
// resume's shape is a fact about the document, and reading it is more reliable
// than deciding it. So a section holds lines - the lines the candidate printed,
// with the text they printed, in the order they printed them, each marked as a
// bullet or not. Nothing has to be routed anywhere, so nothing can be routed
// wrong, and nothing can fail to fit.

/**
 * One printed line of the resume.
 *
 * `text` is verbatim, INCLUDING any tab. A tab is not whitespace to be tidied
 * away: it is how a resume right-aligns the date at the end of a line, and it
 * is the only record that the date belonged there rather than on a line of its
 * own. Everything downstream treats it as the layout instruction it is.
 */
export interface ResumeBlock {
  /** True when the resume printed this line with a bullet glyph. */
  bullet: boolean;
  text: string;
  /**
   * Which paragraph of the uploaded .docx this line is, when it came from one.
   *
   * This is what lets a download write the tailored words back into the user's
   * own paragraph instead of a paragraph we built to look like it. Their
   * spacing, tab stops, bold spans, list numbering and fonts are then preserved
   * because nothing ever recreated them.
   *
   * Absent for a resume uploaded as a PDF, and for a line the user added in the
   * editor - neither has a paragraph in the source file to go back to.
   */
  source?: number;
}

/** One section, exactly as the resume printed it. */
export interface ResumeSection {
  /** Verbatim - "RELEVANT EXPERIENCE", not our idea of what to call it. */
  heading: string;
  /** Every line under that heading, in order. */
  blocks: ResumeBlock[];
  /** The heading's own paragraph in the uploaded .docx, when it came from one. */
  headingSource?: number;
}

/** A parsed resume. This is the object the whole app passes around. */
export interface ResumeDoc {
  name: string;
  contact: string;
  sections: ResumeSection[];
  /** Source paragraphs for the two lines that sit outside any section. */
  nameSource?: number;
  contactSource?: number;
}

/**
 * Every tag name that may legally appear in a tagged document. A closed set,
 * so a hallucinated tag is a parse error rather than content that silently
 * vanishes - and now only seven, because the format no longer needs a tag per
 * section type or a tag per line role.
 */
export const TAG_VOCABULARY = [
  'resume',
  'name',
  'contact',
  'section',
  'heading',
  'line',
  'bullet',
] as const;

export type TagName = (typeof TAG_VOCABULARY)[number];

// -- style slots --------------------------------------------------------------

/**
 * The parts of a resume a Word template can style, and what the built-in
 * layout formats when it cannot.
 *
 * Five, down from nine and before that seventeen. Each drop came from removing
 * an assumption about structure rather than from cutting features: a bullet is
 * a bullet whichever section it is in, and a line is a line whether it names an
 * employer or lists a language.
 */
export const STYLE_SLOTS = [
  { key: 'name', label: 'Candidate name' },
  { key: 'contact', label: 'Contact line' },
  { key: 'sectionHeading', label: 'Section heading' },
  { key: 'entryLine', label: 'Employer / project line' },
  { key: 'line', label: 'Paragraph / skills line' },
  { key: 'bullet', label: 'Bullet point' },
] as const;

export type StyleSlot = (typeof STYLE_SLOTS)[number]['key'];

/** Maps each style slot to a Word `w:styleId` from the user's template. */
export type StyleMapping = Partial<Record<StyleSlot, string>>;

/**
 * Which slot a block renders as.
 *
 * The one derived thing in this file, and deliberately so. A line that
 * introduces bullets is the line naming an employer, a project or a degree, and
 * every resume layout gives it more weight than the prose around it. A line
 * with no bullets under it is a paragraph - a skills list, a summary - and is
 * set as body text.
 *
 * This is a statement about OUR layout, not a guess about the candidate's
 * document: it decides what the built-in template emphasises and which template
 * style a line claims. It cannot lose or move content, because the block list
 * is unchanged either way. It lives here so all three renderers ask the same
 * question and cannot disagree about the answer.
 */
export function blockSlot(blocks: ResumeBlock[], index: number): StyleSlot {
  if (blocks[index]?.bullet) return 'bullet';
  return blocks[index + 1]?.bullet ? 'entryLine' : 'line';
}

// -- normalisation ------------------------------------------------------------

export function emptyBlock(bullet = false): ResumeBlock {
  return { bullet, text: '' };
}

export function emptySection(): ResumeSection {
  return { heading: '', blocks: [] };
}

/** An empty document - the starting point when parsing. */
export function emptyDoc(): ResumeDoc {
  return { name: '', contact: '', sections: [] };
}

/** Fills in a block's missing fields, so partial stored data is safe to use. */
export function normaliseBlock(block: Partial<ResumeBlock> | null | undefined): ResumeBlock {
  const normalised: ResumeBlock = { bullet: block?.bullet === true, text: block?.text ?? '' };
  // Only carried when it is a real index. An undefined `source` means "this
  // line has no paragraph of its own in the source file", which is different
  // from paragraph zero.
  if (typeof block?.source === 'number' && Number.isInteger(block.source) && block.source >= 0) {
    normalised.source = block.source;
  }
  return normalised;
}

/** Fills in a section's missing fields. */
export function normaliseSection(
  section: Partial<ResumeSection> | null | undefined
): ResumeSection {
  const normalised: ResumeSection = {
    heading: section?.heading ?? '',
    blocks: (section?.blocks ?? []).map(normaliseBlock),
  };
  if (typeof section?.headingSource === 'number') normalised.headingSource = section.headingSource;
  return normalised;
}

/**
 * True when a section would print anything at all.
 *
 * A heading on its own does not count. A section whose lines were all deleted
 * should disappear, not leave a bare heading with nothing under it.
 */
export function hasContent(section: ResumeSection): boolean {
  return normaliseSection(section).blocks.some((block) => block.text.trim().length > 0);
}

/**
 * Fills in a document's missing fields.
 *
 * Anything reaching a renderer or the editor goes through here first. Stored
 * documents outlive the code that wrote them - a resume in sessionStorage, or
 * a row saved before the format changed - and a missing `sections` array is a
 * crash rather than a degraded render. This is the one place that has to
 * assume nothing about what it is handed.
 */
export function normaliseDoc(doc: Partial<ResumeDoc> | null | undefined): ResumeDoc {
  const normalised: ResumeDoc = {
    name: doc?.name ?? '',
    contact: doc?.contact ?? '',
    sections: (doc?.sections ?? []).map(normaliseSection),
  };
  if (typeof doc?.nameSource === 'number') normalised.nameSource = doc.nameSource;
  if (typeof doc?.contactSource === 'number') normalised.contactSource = doc.contactSource;
  return normalised;
}
