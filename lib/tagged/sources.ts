// Restores paragraph references after an AI pass that may restructure.
//
// A block's `source` is the paragraph of the user's .docx it will be written
// back into, and it is deliberately never shown to the model - the tagged
// format carries text only, so nothing can renumber one. That means every
// round trip loses them and something has to put them back.
//
// Tailoring restores them positionally, which is exact: assertSameSkeleton has
// already proved the two documents have the same shape. Resume Studio's editor
// cannot do that, because the user is allowed to ask for structural change -
// "move Projects above Experience", "drop my first internship" - so position
// means nothing afterwards.
//
// So they are matched by text instead. A line whose wording came back unchanged
// is the same line, and gets its paragraph back; a line the instruction
// actually rewrote does not, and is rebuilt from the formatting of its
// neighbours. That is the honest trade: an edited line loses its run-level
// formatting, and every line the edit did not touch keeps everything.

import { normaliseDoc, type ResumeDoc } from './schema';

/** Comparable form of a line: case and spacing carry no identity here. */
function key(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Gives `after` back the paragraph references from `before`, matching on text.
 *
 * Each source paragraph is claimed at most once, so a line duplicated by an
 * edit does not end up with two lines pointing at one paragraph - the second
 * is treated as new, which is what it is.
 */
export function carrySources(before: ResumeDoc, after: ResumeDoc): ResumeDoc {
  const original = normaliseDoc(before);
  const edited = normaliseDoc(after);

  // Every line of the original that has a paragraph, by its text. A repeated
  // line keeps its earliest paragraph.
  const available = new Map<string, number[]>();
  for (const section of original.sections) {
    for (const block of section.blocks) {
      if (block.source === undefined) continue;
      const bucket = available.get(key(block.text));
      if (bucket) bucket.push(block.source);
      else available.set(key(block.text), [block.source]);
    }
  }

  const headings = new Map<string, number[]>();
  for (const section of original.sections) {
    if (section.headingSource === undefined) continue;
    const bucket = headings.get(key(section.heading));
    if (bucket) bucket.push(section.headingSource);
    else headings.set(key(section.heading), [section.headingSource]);
  }

  const claim = (pool: Map<string, number[]>, text: string): number | undefined =>
    pool.get(key(text))?.shift();

  const result: ResumeDoc = {
    name: edited.name,
    contact: edited.contact,
    sections: edited.sections.map((section) => {
      const headingSource = claim(headings, section.heading);
      return {
        heading: section.heading,
        ...(headingSource === undefined ? {} : { headingSource }),
        blocks: section.blocks.map((block) => {
          const source = claim(available, block.text);
          return {
            bullet: block.bullet,
            text: block.text,
            ...(source === undefined ? {} : { source }),
          };
        }),
      };
    }),
  };

  // The name and contact line are only reclaimed if the edit left them alone.
  // A rewritten name is a new line and must not be written into the paragraph
  // that held the old one under its formatting.
  if (original.nameSource !== undefined && key(original.name) === key(edited.name)) {
    result.nameSource = original.nameSource;
  }
  if (original.contactSource !== undefined && key(original.contact) === key(edited.contact)) {
    result.contactSource = original.contactSource;
  }

  return result;
}
