// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  sanitizeResumeHtml,
  linkifyResumeHtml,
  applyChangesToHtml,
  MAX_RESUME_HTML_CHARS,
} from '@/lib/resumeHtml';

// A valid baseline body comfortably over the 40-char minimum.
const VALID_BODY =
  '<h1>Jordan Smith</h1><p>jordan@example.com | 555-0100</p><ul><li>Built things</li></ul>';

describe('sanitizeResumeHtml', () => {
  it('passes clean resume HTML through unchanged', () => {
    expect(sanitizeResumeHtml(VALID_BODY)).toBe(VALID_BODY);
  });

  it('unwraps markdown code fences', () => {
    expect(sanitizeResumeHtml('```html\n' + VALID_BODY + '\n```')).toBe(VALID_BODY);
  });

  it('unwraps a full document down to the body content', () => {
    const doc = `<html><head><title>x</title></head><body>${VALID_BODY}</body></html>`;
    expect(sanitizeResumeHtml(doc)).toBe(VALID_BODY);
  });

  it('strips <script> blocks entirely', () => {
    const out = sanitizeResumeHtml(`${VALID_BODY}<script>alert('xss')</script>`);
    expect(out).not.toBeNull();
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert');
  });

  it('strips <style> blocks entirely', () => {
    const out = sanitizeResumeHtml(`${VALID_BODY}<style>body{display:none}</style>`);
    expect(out).not.toContain('style');
  });

  it('strips inline event handlers (double- and single-quoted)', () => {
    const out = sanitizeResumeHtml(
      `<h1 onclick="steal()">Jordan Smith</h1><p onmouseover='x()'>jordan@example.com | 555-0100</p>`,
    );
    expect(out).not.toBeNull();
    expect(out).not.toMatch(/on\w+\s*=/);
  });

  it('strips javascript: URLs', () => {
    const out = sanitizeResumeHtml(
      `${VALID_BODY}<p><a href="javascript:alert(1)">portfolio</a></p>`,
    );
    expect(out).not.toContain('javascript:');
  });

  it.each([
    ['non-HTML text', 'This is just a plain sentence with no markup at all, sorry.'],
    ['too-short output', '<h1>Hi</h1>'],
    ['oversized output', '<p>' + 'x'.repeat(MAX_RESUME_HTML_CHARS) + '</p>'],
  ])('returns null for %s', (_label, input) => {
    expect(sanitizeResumeHtml(input)).toBeNull();
  });
});

describe('linkifyResumeHtml', () => {
  it('wraps bare https URLs in anchors', () => {
    const out = linkifyResumeHtml('<p>See https://example.com/work for details</p>');
    expect(out).toContain('<a href="https://example.com/work">https://example.com/work</a>');
  });

  it('wraps www URLs with an https href', () => {
    const out = linkifyResumeHtml('<p>Visit www.example.com today</p>');
    expect(out).toContain('<a href="https://www.example.com">www.example.com</a>');
  });

  it('wraps email addresses in mailto anchors', () => {
    const out = linkifyResumeHtml('<p>Contact jordan@example.com for references</p>');
    expect(out).toContain('<a href="mailto:jordan@example.com">jordan@example.com</a>');
  });

  it('attaches a known destination URL to its bare display text', () => {
    const out = linkifyResumeHtml('<p>Portfolio: example.tech</p>', ['https://example.tech']);
    expect(out).toContain('<a href="https://example.tech">example.tech</a>');
  });

  it('leaves text already inside an anchor untouched', () => {
    const html = '<p><a href="https://example.com">https://example.com</a></p>';
    expect(linkifyResumeHtml(html)).toBe(html);
  });

  it('never rewrites tag markup itself', () => {
    const html = '<p class="contact.line">no links here</p>';
    expect(linkifyResumeHtml(html)).toBe(html);
  });
});

describe('applyChangesToHtml', () => {
  const html =
    '<ul><li>Built internal dashboards for the sales team</li><li>Wrote unit tests</li></ul>';

  it('replaces a matching bullet and counts it', () => {
    const { html: out, applied } = applyChangesToHtml(html, [
      { original: 'Built internal dashboards for the sales team', tailored: 'Shipped analytics dashboards used by 40 reps' },
    ]);
    expect(applied).toBe(1);
    expect(out).toContain('Shipped analytics dashboards used by 40 reps');
    expect(out).not.toContain('Built internal dashboards');
    // Untouched bullets survive.
    expect(out).toContain('Wrote unit tests');
  });

  it('matches bullets whitespace- and case-insensitively', () => {
    const { applied } = applyChangesToHtml(html, [
      { original: '  BUILT   internal DASHBOARDS for the sales team ', tailored: 'x' },
    ]);
    expect(applied).toBe(1);
  });

  it('applies nothing when no bullet matches', () => {
    const { html: out, applied } = applyChangesToHtml(html, [
      { original: 'A bullet that does not exist', tailored: 'irrelevant' },
    ]);
    expect(applied).toBe(0);
    expect(out).toBe(html);
  });

  it('escapes HTML in the tailored replacement text', () => {
    const { html: out } = applyChangesToHtml(html, [
      { original: 'Wrote unit tests', tailored: 'Used <script> & "quotes"' },
    ]);
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&amp;');
    expect(out).toContain('&quot;quotes&quot;');
  });

  it('replaces at most one bullet per change', () => {
    const dupes = '<ul><li>Same text</li><li>Same text</li></ul>';
    const { html: out, applied } = applyChangesToHtml(dupes, [
      { original: 'Same text', tailored: 'New text' },
    ]);
    expect(applied).toBe(1);
    expect(out.match(/Same text/g)).toHaveLength(1);
    expect(out.match(/New text/g)).toHaveLength(1);
  });
});
