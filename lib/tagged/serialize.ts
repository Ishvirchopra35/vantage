// Converts between the typed ResumeDoc and its tagged-XML wire format.
//
// A full XML parser is overkill: the vocabulary is closed, shallow and known
// ahead of time, so a handful of scoped regexes is simpler and easier to reason
// about. It also means we control exactly what counts as valid rather than
// inheriting a parser's tolerance for junk.
//
// The wire format carries text only. A block's `source` - the paragraph of the
// user's .docx it came from - deliberately never reaches the model: there is
// nothing it could usefully do with a paragraph index and every reason not to
// let it renumber one. The indices are restored positionally by lockFields
// after the round trip, which the skeleton check makes safe.

import {
  emptyDoc,
  normaliseSection,
  TAG_VOCABULARY,
  type ResumeBlock,
  type ResumeDoc,
} from './schema';

const VOCAB = new Set<string>(TAG_VOCABULARY);

// -- escaping -----------------------------------------------------------------

/** Escapes text so it can sit safely inside a tag body. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Reverses escapeXml, plus the `&apos;` an AI may emit unprompted. */
function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // `&amp;` last, otherwise "&amp;lt;" would decode twice into "<".
    .replace(/&amp;/g, '&');
}

/**
 * Tabs survive the round trip as a literal escape.
 *
 * A tab is content - it is how a resume right-aligns the date at the end of a
 * line - but it is also whitespace, and every parser here trims. Writing it as
 * "\t" means the model reads something it obviously must copy, and the trim on
 * the way back cannot silently take the layout with it.
 */
function encodeTabs(value: string): string {
  // The backslash is escaped first, so text that already contained "\t" as two
  // literal characters comes back as those two characters rather than turning
  // into a tab. Without this the encoding is not reversible, and a round trip
  // silently invents layout out of someone's file path.
  return value.replace(/\\/g, '\\\\').replace(/\t/g, '\\t');
}

function decodeTabs(value: string): string {
  // One pass, so an escaped backslash cannot combine with the character after
  // it: "\\t" is a backslash followed by t, never a tab.
  return value.replace(/\\([\\t])/g, (_, character) => (character === 't' ? '\t' : '\\'));
}

// -- serialize ----------------------------------------------------------------

function tag(name: string, value: string, indent: string): string {
  return `${indent}<${name}>${escapeXml(encodeTabs(value.trim()))}</${name}>`;
}

/** Renders a ResumeDoc as the tagged text handed to (and read back from) the AI. */
export function docToTagged(doc: ResumeDoc): string {
  const lines: string[] = ['<resume>'];

  lines.push(tag('name', doc.name, '  '));
  lines.push(tag('contact', doc.contact, '  '));

  for (const raw of doc.sections) {
    const section = normaliseSection(raw);

    // Blank content is dropped rather than emitted empty, because taggedToDoc
    // drops it on the way back and docToTagged has to be idempotent:
    // lib/tagged/tailor.ts compares the skeleton of what it sent against the
    // skeleton of what returned, and both sides normalise through here. A tag
    // the parser then discards would look like the model had deleted content.
    const blocks = section.blocks.filter((block) => block.text.trim());
    if (!section.heading.trim() && blocks.length === 0) continue;

    lines.push('  <section>');
    lines.push(tag('heading', section.heading, '    '));
    for (const block of blocks) {
      lines.push(tag(block.bullet ? 'bullet' : 'line', block.text, '    '));
    }
    lines.push('  </section>');
  }

  lines.push('</resume>');
  return lines.join('\n');
}

// -- parse --------------------------------------------------------------------

/** Text of the first matching tag in `scope`, or '' when absent. */
function first(scope: string, name: string): string {
  const match = scope.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? decodeTabs(unescapeXml(match[1]).trim()) : '';
}

/**
 * Rejects any tag outside the vocabulary. This is what stops a hallucinated
 * block from silently vanishing at parse time - better to fail loudly and
 * retry than hand back a resume that quietly dropped content.
 */
function assertKnownTags(xml: string): void {
  const unknown = new Set<string>();
  for (const match of xml.matchAll(/<\/?([a-zA-Z][\w-]*)\s*\/?>/g)) {
    if (!VOCAB.has(match[1])) unknown.add(match[1]);
  }
  if (unknown.size > 0) {
    throw new Error(`Tagged resume contains unknown tags: ${[...unknown].join(', ')}`);
  }
}

/** Parses tagged text back into a ResumeDoc. Throws on anything malformed. */
export function taggedToDoc(xml: string): ResumeDoc {
  // Models like to wrap output in a code fence no matter how firmly asked not to.
  const cleaned = xml
    .replace(/^\s*```(?:xml)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const body = cleaned.match(/<resume>([\s\S]*)<\/resume>/);
  if (!body) throw new Error('Tagged resume is missing its <resume> wrapper');

  assertKnownTags(cleaned);

  const scope = body[1];
  const doc = emptyDoc();

  doc.name = first(scope, 'name');
  doc.contact = first(scope, 'contact');

  for (const match of scope.matchAll(/<section>([\s\S]*?)<\/section>/g)) {
    const sectionScope = match[1];

    // Read in document order across both tag names, so a section's lines and
    // bullets come back interleaved exactly as the resume printed them. Reading
    // each tag separately would group all the lines then all the bullets and
    // quietly reorder the document.
    const blocks: ResumeBlock[] = [];
    for (const blockMatch of sectionScope.matchAll(/<(line|bullet)>([\s\S]*?)<\/\1>/g)) {
      const text = decodeTabs(unescapeXml(blockMatch[2]).trim());
      if (text) blocks.push({ bullet: blockMatch[1] === 'bullet', text });
    }

    const heading = first(sectionScope, 'heading');
    if (heading || blocks.length > 0) doc.sections.push({ heading, blocks });
  }

  return doc;
}
