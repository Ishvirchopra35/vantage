import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Design-system / theme-token coverage.
//
// A practical, low-false-positive static scan: walks the rendered marketing +
// auth source files and flags hardcoded hex / rgb() / rgba() color literals
// used where a theme token should be, so an edit that hardcodes an off-theme
// color is caught before it breaks light/dark correctness.
//
// jsdom cannot compute stylesheet-derived / theme-variable colors reliably,
// so the scan asserts on source text directly.

const projectRoot = process.cwd();

// ---------------------------------------------------------------------------
// Allowlist - every entry documents WHY the literal is intentional.
// These are semantic / brand / decorative values deliberately fixed across
// BOTH themes (that is exactly why they are literals and not tokens).
// ---------------------------------------------------------------------------

// Semantic status / score colors and their lighter status-text tints.
const ALLOWED_HEX = new Set<string>([
  '#ef4444', // --score-red   (error / status red-500)
  '#f59e0b', // --score-amber (warning / status amber-500)
  '#22c55e', // --score-green (success / status green-500)
  '#4ade80', // green-400  - success status TEXT tint (ContactForm success banner)
  '#86efac', // green-300  - success tint
  '#fbbf24', // amber-400  - warning tint
  '#fca5a5', // red-300    - error tint
  '#f87171', // red-400    - error status TEXT tint (symmetric to #4ade80)
]);

// rgb()/rgba() literals are matched on their RGB triple only (alpha-independent),
// because the same semantic/brand color legitimately appears at several opacities.
const ALLOWED_RGB_TRIPLES = new Set<string>([
  '239,68,68', //  --score-red   - error banner bg/border (auth + contact form)
  '245,158,11', // --score-amber - warning surfaces
  '34,197,94', //  --score-green - success banner bg/border
  '99,102,241', // info indigo   - informational accents
  '59,130,246', // info blue     - informational accents
  '212,168,71', // brand GOLD (== --gold #d4a847) - decorative glow shadows & borders
  '201,162,39', // headline GOLD (#c9a227) - landing hero metallic accent glows,
  //               intentionally identical in both themes (see landing hero design)
  '255,255,255', // white-alpha - dark-glass material overlays (hairline borders,
  //               glass fills at 0.05-0.08 alpha) - part of the .ds-* material system
  '0,0,0', //      pure black    - modal/overlay backdrop scrims
]);

// Files excluded from the scan entirely, each with a documented reason.
const FILE_EXCLUSIONS = new Set<string>([
  // Canvas-rendered particle systems: the 2D canvas API takes literal color
  // strings and cannot read CSS custom properties, so tokens are impossible here.
  'components/marketing/LandingParticles.tsx',
  'components/marketing/Particles.tsx',
]);

// ---------------------------------------------------------------------------

const IN_SCOPE_DIRS = ['app/(marketing)', 'app/(auth)', 'components/marketing'];

function collectTsxFiles(relDir: string): string[] {
  const abs = resolve(projectRoot, relDir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const absChild = join(abs, entry);
    const relChild = `${relDir}/${entry}`;
    const st = statSync(absChild);
    if (st.isDirectory()) {
      out.push(...collectTsxFiles(relChild));
    } else if (entry.endsWith('.tsx') && !FILE_EXCLUSIONS.has(relChild)) {
      out.push(relChild);
    }
  }
  return out;
}

const HEX_RE = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g;
const RGB_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,[^)]*)?\)/gi;

function normalizeHex(hex: string): string {
  let h = hex.toLowerCase();
  if (h.length === 4) {
    h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  return h;
}

interface Violation {
  file: string;
  line: number;
  literal: string;
}

function scanFile(relPath: string): Violation[] {
  const source = readFileSync(resolve(projectRoot, relPath), 'utf8');
  const violations: Violation[] = [];

  source.split(/\r?\n/).forEach((line, idx) => {
    for (const m of line.matchAll(HEX_RE)) {
      if (!ALLOWED_HEX.has(normalizeHex(m[0]))) {
        violations.push({ file: relPath, line: idx + 1, literal: m[0] });
      }
    }
    for (const m of line.matchAll(RGB_RE)) {
      const triple = `${m[1]},${m[2]},${m[3]}`;
      if (!ALLOWED_RGB_TRIPLES.has(triple)) {
        violations.push({ file: relPath, line: idx + 1, literal: m[0].replace(/\s+/g, '') });
      }
    }
  });

  return violations;
}

describe('no disallowed hardcoded color literals in marketing/auth UI', () => {
  const files = IN_SCOPE_DIRS.flatMap(collectTsxFiles);

  it('discovers in-scope source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('contains no non-allowlisted hex / rgb / rgba color literals', () => {
    const allViolations = files.flatMap(scanFile);
    const report = allViolations.map((v) => `  ${v.file}:${v.line}  ${v.literal}`).join('\n');

    expect(
      allViolations,
      allViolations.length
        ? `Disallowed hardcoded color literals found (use a theme token, or add to the ` +
          `documented allowlist if intentional):\n${report}`
        : undefined,
    ).toEqual([]);
  });
});
