// Finds the hyperlinks hiding inside a field's plain text.
//
// The tagged format is text-only by design - it has no place to record that
// "LinkedIn" was a link rather than a word. That is deliberate: giving the AI
// href attributes to copy is giving it something to hallucinate. So the address
// travels through the pipeline *as text*, put there by flattenLink() in
// extractText.ts, and this module turns it back into a real link at the very
// last step, deterministically.
//
// Both generators use it: lib/docx/inject.ts emits <w:hyperlink>, and
// lib/docx/fallback.ts emits the docx library's ExternalHyperlink.

/** A stretch of a field's text. `href` set means it should be a hyperlink. */
export interface TextRunPart {
  text: string;
  href?: string;
}

/**
 * Where in the resume this text sits.
 *
 * "Node.js" and "janedoe.dev" are the same shape - a word, a dot, a couple of
 * letters - so nothing about the characters themselves says which is an
 * address. What says it is *where it appears*. A dotted token on the contact
 * line is an address, because that line is a list of ways to reach someone. A
 * dotted token in a bullet about a candidate's work is a technology, because
 * that is what bullets talk about.
 *
 * This replaced a list of accepted TLDs plus a list of technologies that
 * collided with them ("socket.io", "asp.net"). Both had the same flaw: they
 * only knew what someone had thought to write down, so an unusual domain went
 * unlinked and the next framework named after a TLD became a broken link.
 */
export interface LinkContext {
  /**
   * True where a bare "something.something" should be read as an address.
   * Set for the contact line and nothing else.
   */
  addressesExpected?: boolean;
}

// Order matters: the "Label (address)" form is tried first so its inner address
// is consumed as part of the whole match rather than matched on its own.
//
//  1. Label (address)   - what flattenLink() writes for a titled link
//  2. scheme:// or www. - written out in full, unambiguous anywhere
//  3. email
//  4. dotted token with a path - "github.com/jane" is a location, not a name
//
// None of these needs to know what a valid TLD is. A scheme, a "www.", an "@"
// or a path is what makes something an address, and all four are structural.
const PATTERNS: readonly RegExp[] = [
  /([^\s(|,;][^(|,;]*?)\s*\((?:(https?:\/\/|mailto:)?((?:www\.)?[\w-]+(?:\.[\w-]+)+(?:\/[^\s)]*)?))\)/,
  /(?:https?:\/\/|www\.)[^\s<>()|,;]+[^\s<>()|,;.]/,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /[\w-]+(?:\.[\w-]+)*\.\p{L}{2,}\/[^\s<>()|,;]*/u,
];

/**
 * The one pattern that needs to know where it is: a bare dotted token with no
 * scheme, no path and no "@" to give it away. Only consulted where addresses
 * are expected.
 */
// \p{L} rather than [A-Za-z]: an internationalised domain is still a domain,
// and there is no reason for a candidate's non-Latin address to be the one
// that quietly fails.
const BARE_ADDRESS = /[\w-]+(?:\.[\w-]+)*\.\p{L}{2,}/u;

/** Turns a matched address into something a browser will actually open. */
function toHref(address: string): string {
  const trimmed = address.trim().replace(/[.,;]+$/, '');
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9._%+-]+@/.test(trimmed)) return `mailto:${trimmed}`;
  return `https://${trimmed.replace(/^www\./i, 'www.')}`;
}

/**
 * Splits `text` into plain and linked parts, in order. Concatenating every
 * part's `text` does NOT always reproduce the input: the "Label (address)"
 * form collapses to just "Label", which is the point - it restores the
 * appearance of the original resume, where the address was hidden behind the
 * label rather than printed beside it.
 */
export function splitRuns(text: string, context: LinkContext = {}): TextRunPart[] {
  const patterns = context.addressesExpected ? [...PATTERNS, BARE_ADDRESS] : PATTERNS;

  const parts: TextRunPart[] = [];
  let rest = text;

  while (rest) {
    // Whichever pattern matches earliest wins, so a plain URL later in the
    // line never pre-empts a "Label (address)" pair earlier in it.
    let bestIndex = -1;
    let bestMatch: RegExpMatchArray | null = null;

    for (const pattern of patterns) {
      const match = rest.match(pattern);
      if (!match || match.index === undefined) continue;
      if (bestIndex === -1 || match.index < bestIndex) {
        bestIndex = match.index;
        bestMatch = match;
      }
    }

    if (!bestMatch || bestIndex === -1) break;

    const end = bestIndex + bestMatch[0].length;
    const before = rest.slice(0, bestIndex);
    if (before) parts.push({ text: before });

    // Group 1 is the label and group 3 the address, but only for the first
    // pattern; the others match the address itself and use it as its own label.
    const label = bestMatch[3] ? bestMatch[1].trim() : bestMatch[0];
    const address = bestMatch[3] ? `${bestMatch[2] ?? ''}${bestMatch[3]}` : bestMatch[0];

    parts.push({ text: label, href: toHref(address) });
    rest = rest.slice(end);
  }

  if (rest) parts.push({ text: rest });
  // A field with no links at all still has to come back as one run.
  return parts.length > 0 ? parts : [{ text }];
}

/** True when this text contains at least one thing worth linking. */
export function hasLinks(text: string, context: LinkContext = {}): boolean {
  return splitRuns(text, context).some((part) => part.href);
}

/**
 * The text as a reader should see it, with addresses hidden behind their
 * labels: "LinkedIn (linkedin.com/in/jane)" becomes "LinkedIn".
 *
 * The address has to travel through the pipeline as text - that is how the
 * tagged format carries a link at all - but showing it in the preview means
 * showing the user something their finished resume will not contain. This is
 * what the preview displays; the underlying value keeps the address so the
 * generators can still rebuild the link.
 */
export function collapseLinkText(text: string): string {
  return splitRuns(text)
    .map((part) => part.text)
    .join('');
}

/**
 * Splits a line at the point where the rest should be pushed to the right
 * margin, or null when it has no such point.
 *
 * Resumes right-align dates: "Project Intern    Jun. 2024 - Sep. 2024" with the
 * date hard against the right edge. In a Word file that is a tab against a
 * right-aligned tab stop, and the tab survives extraction - so the tab IS the
 * instruction, and honouring it reproduces the original layout exactly rather
 * than guessing which part of the line is a date.
 *
 * Only the last tab counts. A line with several is using them to lay out
 * columns, and the right margin is where the final one lands.
 */
export function splitAtTab(text: string): { left: string; right: string } | null {
  const at = text.lastIndexOf('	');
  if (at === -1) return null;

  const left = text.slice(0, at).replace(/\s+$/, '');
  const right = text.slice(at + 1).replace(/^\s+/, '').replace(/\s+/g, ' ').trim();
  if (!right) return null;

  return { left, right };
}
