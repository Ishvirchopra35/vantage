// Shape checks for a ResumeDoc arriving from outside the server.
//
// Two places need this: the upload route, which stores whatever the client
// hands back from the parse step, and the download route, which accepts the
// version the user edited in the browser. Both feed the generators, and
// failing fast here beats failing deep inside the XML builder with an error
// nobody can act on.

import type { ResumeDoc, ResumeSection } from './schema';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Structural check only - it does not judge whether the content is any good. */
export function isResumeDoc(value: unknown): value is ResumeDoc {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Record<string, unknown>;

  if (typeof doc.name !== 'string' || typeof doc.contact !== 'string') return false;
  if (!Array.isArray(doc.sections)) return false;

  return doc.sections.every((raw) => {
    const section = raw as Record<string, unknown>;
    if (!section || typeof section.heading !== 'string') return false;
    if (!Array.isArray(section.blocks)) return false;

    return section.blocks.every((rawBlock) => {
      const block = rawBlock as Record<string, unknown>;
      return !!block && typeof block.text === 'string' && typeof block.bullet === 'boolean';
    });
  });
}

/**
 * Rough size ceiling, checked before anything expensive touches the document.
 * A resume this large is a paste accident or an attack, not a career.
 */
export function isReasonableSize(doc: ResumeDoc): boolean {
  return (
    doc.sections.length <= 30 &&
    doc.sections.every((section) => section.blocks.length <= 300) &&
    JSON.stringify(doc).length <= 400_000
  );
}

// -- older stored shapes ------------------------------------------------------

/** A line, kept only when it has something on it. */
function line(text: unknown, bullet: boolean): { bullet: boolean; text: string }[] {
  const value = typeof text === 'string' ? text.trim() : '';
  return value ? [{ bullet, text: value }] : [];
}

/**
 * Converts a document stored with fixed slots inside each entry.
 *
 * That shape gave every entry a title, a subtitle and a meta line, so a resume
 * that printed all three on ONE line came out split across three. The
 * conversion cannot put them back together - the information that they shared a
 * line is not in the stored data - but it keeps every word, in order, which is
 * what matters for a document the user can still download.
 */
function fromEntrySections(value: unknown): ResumeDoc | null {
  if (!value || typeof value !== 'object') return null;
  const doc = value as Record<string, unknown>;
  if (typeof doc.name !== 'string' || !Array.isArray(doc.sections)) return null;

  // Recognised by what the old shape had and the current one does not.
  const looksOld = doc.sections.some((raw) => {
    const section = raw as Record<string, unknown>;
    return !!section && Array.isArray(section.entries) && !Array.isArray(section.blocks);
  });
  if (!looksOld) return null;

  const sections: ResumeSection[] = doc.sections.map((raw) => {
    const section = (raw ?? {}) as Record<string, unknown>;
    const blocks: ResumeSection['blocks'] = [];

    blocks.push(...line(section.text, false));

    for (const rawEntry of Array.isArray(section.entries) ? section.entries : []) {
      const entry = (rawEntry ?? {}) as Record<string, unknown>;
      blocks.push(...line(entry.title, false));
      blocks.push(...line(entry.subtitle, false));
      blocks.push(...line(entry.meta, false));
      for (const bullet of isStringArray(entry.bullets) ? entry.bullets : []) {
        blocks.push(...line(bullet, true));
      }
    }

    for (const item of isStringArray(section.items) ? section.items : []) {
      blocks.push(...line(item, true));
    }

    return { heading: typeof section.heading === 'string' ? section.heading : '', blocks };
  });

  return {
    name: doc.name,
    contact: typeof doc.contact === 'string' ? doc.contact : '',
    sections: sections.filter((section) => section.heading.trim() || section.blocks.length > 0),
  };
}

/**
 * Converts a document stored in the original bucketed shape.
 *
 * That shape had fixed fields - experience[], education[], skills[],
 * publications[], custom[] - where this one has a list of the resume's own
 * sections. Existing rows are converted rather than re-parsed, so a resume
 * tailored before the change can still be downloaded and nobody is told to
 * start again.
 *
 * Returns null for anything not recognisably that shape.
 */
export function fromLegacyDoc(value: unknown): ResumeDoc | null {
  if (!value || typeof value !== 'object') return null;
  const legacy = value as Record<string, unknown>;
  if (typeof legacy.name !== 'string' || !Array.isArray(legacy.experience)) return null;

  const sections: ResumeSection[] = [];

  const push = (heading: string, blocks: ResumeSection['blocks']) => {
    if (blocks.length > 0) sections.push({ heading, blocks });
  };

  const text = (key: string) => (typeof legacy[key] === 'string' ? (legacy[key] as string) : '');
  const list = (key: string) => (isStringArray(legacy[key]) ? (legacy[key] as string[]) : []);
  const rows = (key: string) => (Array.isArray(legacy[key]) ? legacy[key] : []);

  const entryBlocks = (
    raw: unknown,
    fields: string[],
    joined: string[]
  ): ResumeSection['blocks'] => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const blocks: ResumeSection['blocks'] = [];
    for (const field of fields) blocks.push(...line(row[field], false));
    const detail = joined.map((f) => row[f]).filter(Boolean).join('  |  ');
    blocks.push(...line(detail, false));
    for (const bullet of isStringArray(row.bullets) ? row.bullets : []) {
      blocks.push(...line(bullet, true));
    }
    return blocks;
  };

  push('', line(text('summary'), false));
  push('EXPERIENCE', rows('experience').flatMap((r) => entryBlocks(r, ['company', 'title'], ['location', 'dates'])));
  push('EDUCATION', rows('education').flatMap((r) => entryBlocks(r, ['school', 'degree'], ['dates'])));
  push('SKILLS', line(list('skills').join(', '), false));
  push('CERTIFICATIONS', list('certifications').flatMap((v) => line(v, true)));
  push('LANGUAGES', line(list('languages').join(', '), false));
  push('PUBLICATIONS', list('publications').flatMap((v) => line(v, true)));
  push('AWARDS', list('awards').flatMap((v) => line(v, true)));

  for (const raw of rows('custom')) {
    const section = (raw ?? {}) as Record<string, unknown>;
    const blocks: ResumeSection['blocks'] = [];
    for (const rawEntry of Array.isArray(section.entries) ? section.entries : []) {
      blocks.push(...entryBlocks(rawEntry, ['label'], []));
    }
    for (const item of isStringArray(section.items) ? section.items : []) {
      blocks.push(...line(item, true));
    }
    push(typeof section.heading === 'string' ? section.heading : '', blocks);
  }

  return { name: legacy.name, contact: String(legacy.contact ?? ''), sections };
}

/**
 * A usable document from anything stored, whatever shape it is in, or null.
 *
 * The single entry point for data that has been sitting somewhere: a database
 * row, sessionStorage, a request body. Current shape passes straight through,
 * older shapes are converted, and anything else is refused.
 */
export function readStoredDoc(value: unknown): ResumeDoc | null {
  if (isResumeDoc(value)) return value;
  return fromEntrySections(value) ?? fromLegacyDoc(value);
}
