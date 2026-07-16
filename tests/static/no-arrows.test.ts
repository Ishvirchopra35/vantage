import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// No literal arrows in rendered UI: every → (U+2192) / ← (U+2190) in a rendered
// position must be an <ArrowIcon />. Static source scan over app/**, components/**
// and the raw-rendered changelog frontmatter fields.
//
// Allowlist (occurrences that are NOT rendered UI text):
//   - files under app/api/** - AI prompt strings, never rendered
//   - occurrences inside // or /* */ comments (best-effort strip)
//   - app/(marketing)/changelog/page.tsx - the renderArrows implementation must
//     contain arrows in its split regex / comparisons to DETECT and REPLACE them
//   - changelog MDX body prose (transformed by renderArrows at render time) and
//     code blocks (documented exception); only frontmatter title/summary render raw

const projectRoot = process.cwd();

const ARROW = /[→←]/;
const ARROW_GLOBAL = /[→←]/g;

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'coverage']);

const FILE_ALLOWLIST = new Set<string>(['app/(marketing)/changelog/page.tsx']);

function toRel(fullPath: string): string {
  return relative(projectRoot, fullPath).split(sep).join('/');
}

function walk(dir: string, matches: (rel: string) => boolean, acc: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of names) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(full, matches, acc);
    } else if (matches(toRel(full))) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Removes // and block comments while preserving line numbers. Best-effort:
 * a `//` inside a string (e.g. a URL) is treated as a comment start - that can
 * only hide an arrow (false negative), never invent one.
 */
function stripCommentsPreserveLines(src: string): { line: number; text: string }[] {
  const lines = src.split(/\r?\n/);
  const out: { line: number; text: string }[] = [];
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let result = '';
    let j = 0;
    while (j < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', j);
        if (end === -1) {
          j = line.length;
        } else {
          inBlock = false;
          j = end + 2;
        }
      } else {
        const lineComment = line.indexOf('//', j);
        const blockStart = line.indexOf('/*', j);
        if (blockStart !== -1 && (lineComment === -1 || blockStart < lineComment)) {
          result += line.slice(j, blockStart);
          inBlock = true;
          j = blockStart + 2;
        } else if (lineComment !== -1) {
          result += line.slice(j, lineComment);
          j = line.length;
        } else {
          result += line.slice(j);
          j = line.length;
        }
      }
    }
    out.push({ line: i + 1, text: result });
  }
  return out;
}

interface Violation {
  file: string;
  line: number;
  text: string;
}

function scanTsx(fullPath: string): Violation[] {
  const rel = toRel(fullPath);
  const src = readFileSync(fullPath, 'utf8');
  const violations: Violation[] = [];
  for (const { line, text } of stripCommentsPreserveLines(src)) {
    if (ARROW.test(text)) {
      violations.push({ file: rel, line, text: text.trim() });
    }
  }
  return violations;
}

/** Changelog MDX: only frontmatter title/summary render raw (see header note). */
function scanMdx(fullPath: string): Violation[] {
  const rel = toRel(fullPath);
  const lines = readFileSync(fullPath, 'utf8').split(/\r?\n/);
  const violations: Violation[] = [];
  lines.forEach((text, i) => {
    if (/^\s*(title|summary)\s*:/i.test(text) && ARROW.test(text)) {
      violations.push({ file: rel, line: i + 1, text: text.trim() });
    }
  });
  return violations;
}

function isScannableTsx(rel: string): boolean {
  if (!rel.endsWith('.tsx')) return false;
  if (rel.startsWith('app/api/')) return false;
  if (FILE_ALLOWLIST.has(rel)) return false;
  return true;
}

function formatViolations(violations: Violation[]): string {
  const rendered = violations
    .map((v) => {
      const marks = v.text.match(ARROW_GLOBAL)?.join(' ') ?? '';
      return `  - ${v.file}:${v.line}  (${marks})  ${v.text}`;
    })
    .join('\n');
  return (
    `Found ${violations.length} literal arrow occurrence(s) in rendered UI positions. ` +
    `Replace each with <ArrowIcon /> or <ArrowIcon direction="left" />:\n${rendered}`
  );
}

const tsxFiles = [
  ...walk(join(projectRoot, 'app'), isScannableTsx),
  ...walk(join(projectRoot, 'components'), isScannableTsx),
];
const mdxFiles = walk(join(projectRoot, 'content', 'changelog'), (rel) => rel.endsWith('.mdx'));

describe('no literal arrows in rendered UI', () => {
  it('discovers rendered-UI source files to scan', () => {
    expect(tsxFiles.length).toBeGreaterThan(0);
    expect(mdxFiles.length).toBeGreaterThan(0);
  });

  it('contains zero literal arrows in app/** and components/** .tsx rendered text', () => {
    const violations = tsxFiles.flatMap(scanTsx);
    expect(violations, formatViolations(violations)).toEqual([]);
  });

  it('contains zero literal arrows in changelog MDX raw-rendered fields (title/summary)', () => {
    const violations = mdxFiles.flatMap(scanMdx);
    expect(violations, formatViolations(violations)).toEqual([]);
  });
});
