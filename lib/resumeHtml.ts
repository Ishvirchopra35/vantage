// SERVER-SIDE ONLY - shared helpers for AI-generated resume HTML.
// Used by /api/resume-studio (upload -> HTML, chat edits) and
// /api/tailor-resume/render (tailored text -> full downloadable resume).

export const MAX_RESUME_HTML_CHARS = 200_000;

export const RESUME_HTML_RULES =
  `Output ONLY the resume HTML body content using exactly these tags: ` +
  `h1, h2, h3, p, ul, li, strong, em, a (href only). ` +
  `The first element must be <h1> with the candidate's full name, followed by a <p> contact line. ` +
  `No <html>, <head>, <body>, <style>, <script>, <img>, or <table> tags, no CSS classes, ` +
  `no markdown fences, no commentary. Single column.`;

// Belt-and-braces cleanup of AI output: unwrap fences/body, strip anything
// executable. Clients render in sandboxed iframes (scripts blocked) and the
// PDF route sanitizes again, but bad output should die here first.
export function sanitizeResumeHtml(raw: string): string | null {
  let html = raw
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) html = bodyMatch[1].trim();

  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');

  if (!html.startsWith('<') || html.length < 40 || html.length > MAX_RESUME_HTML_CHARS) return null;
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalizes a URL to the bare form users write in resumes ("site.com/path"). */
function displayForms(url: string): string[] {
  const bare = url
    .replace(/^https?:\/\//i, '')
    .replace(/^mailto:/i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
  const forms = new Set<string>([bare, `www.${bare}`, url]);
  return [...forms].filter((f) => f.length > 3);
}

/**
 * Deterministic safety net for hyperlinks: wraps URLs/emails that appear as
 * plain text in <a> tags, and attaches known destination URLs (extracted from
 * the original file's link annotations) to their matching visible text.
 * Text already inside an <a> tag is left alone.
 */
export function linkifyResumeHtml(html: string, knownLinks: string[] = []): string {
  // Split into tag and text segments so replacements never touch tag markup.
  const segments = html.split(/(<[^>]+>)/g);
  let insideAnchor = false;

  const known = knownLinks
    .filter((l) => typeof l === 'string' && /^(https?:\/\/|mailto:)/i.test(l.trim()))
    .map((l) => l.trim())
    .slice(0, 30);

  const linkifyText = (text: string): string => {
    let out = text;

    // 1. Known destinations: link the visible text that matches each URL's
    //    display form (handles "site.tech" whose annotation was https://site.tech).
    for (const url of known) {
      for (const form of displayForms(url)) {
        const re = new RegExp(`(^|[\\s(>])(${escapeRegExp(form)})(?=$|[\\s).,;<])`, 'i');
        if (re.test(out)) {
          out = out.replace(re, (_m, pre, shown) => `${pre}<a href="${escapeHtml(url)}">${shown}</a>`);
          break;
        }
      }
    }

    // 2. Generic patterns: bare http(s)/www URLs and email addresses.
    out = out.replace(
      /(^|[\s(>])((?:https?:\/\/|www\.)[^\s<)]+[^\s<).,;])/gi,
      (_m, pre, url) => {
        const href = /^www\./i.test(url) ? `https://${url}` : url;
        return `${pre}<a href="${escapeHtml(href)}">${url}</a>`;
      }
    );
    out = out.replace(
      /(^|[\s(>])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})(?=$|[\s).,;<])/g,
      (_m, pre, email) => `${pre}<a href="mailto:${email}">${email}</a>`
    );
    return out;
  };

  const result = segments.map((seg) => {
    if (seg.startsWith('<')) {
      if (/^<a[\s>]/i.test(seg)) insideAnchor = true;
      else if (/^<\/a>/i.test(seg)) insideAnchor = false;
      return seg;
    }
    if (insideAnchor || !seg.trim()) return seg;
    // Skip segments that already contain no linkable material fast-path.
    if (!/[@.]/.test(seg)) return seg;
    return linkifyText(seg);
  });

  return result.join('');
}

export interface BulletChange {
  original: string;
  tailored: string;
}

/**
 * Surgical tailoring: replaces each changed bullet's text inside an existing
 * resume HTML (profiles.resume_html), preserving all layout and hyperlinks.
 * Matching is whitespace/case-insensitive on the bullet's text content.
 */
export function applyChangesToHtml(
  html: string,
  changes: BulletChange[]
): { html: string; applied: number } {
  const norm = (s: string): string =>
    s
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  let out = html;
  let applied = 0;

  for (const change of changes) {
    const target = norm(change.original);
    if (!target) continue;
    let replaced = false;
    out = out.replace(/<li([^>]*)>([\s\S]*?)<\/li>/gi, (match, attrs: string, inner: string) => {
      if (replaced) return match;
      const text = norm(inner);
      const isMatch =
        text === target ||
        (target.length > 40 && (text.includes(target) || target.includes(text)));
      if (!isMatch) return match;
      replaced = true;
      applied++;
      return `<li${attrs}>${escapeHtml(change.tailored)}</li>`;
    });
  }

  return { html: out, applied };
}
