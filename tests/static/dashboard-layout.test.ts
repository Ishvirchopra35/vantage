import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Dashboard layout invariants: page centering, the shared filter-control
// box-model, hyperlink styling, and route-transition skeletons. jsdom cannot
// compute stylesheet-derived layout, so these assert against source text.

const projectRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), 'utf8');
}

// -- Page centering ---------------------------------------------------------

function dashboardPageBlock(css: string): string {
  const match = css.match(/\.dashboard-page\s*\{([^}]*)\}/);
  expect(match, 'expected a .dashboard-page rule in globals.css').toBeTruthy();
  return match![1];
}

// The /dashboard landing page is intentionally full-width, so it is excluded.
const CENTERED_PAGES = [
  'app/(dashboard)/profile/page.tsx',
  'app/(dashboard)/jobs/page.tsx',
  'app/(dashboard)/tracker/page.tsx',
  'app/(dashboard)/apply/page.tsx',
  'app/(dashboard)/apply/[jobId]/page.tsx',
  'app/(dashboard)/interview/page.tsx',
  'app/(dashboard)/networking/page.tsx',
  'app/(dashboard)/strategy/page.tsx',
  'app/(dashboard)/tailor/page.tsx',
  'app/(dashboard)/billing/page.tsx',
  'app/(dashboard)/documents/page.tsx',
  'app/(dashboard)/settings/page.tsx',
  'app/(dashboard)/ats/page.tsx',
];

describe('dashboard-page centering', () => {
  it('.dashboard-page is centered with margin: 0 auto', () => {
    const block = dashboardPageBlock(read('app/globals.css'));
    expect(/margin:\s*0\s+auto\b/.test(block)).toBe(true);
    // A bare `margin: 0;` (no auto) would defeat centering.
    expect(/margin:\s*0\s*(?:;|$)/m.test(block)).toBe(false);
  });

  it('.dashboard-page declares a single shared max-width of 900px', () => {
    const block = dashboardPageBlock(read('app/globals.css'));
    const maxWidths = block.match(/max-width:\s*[^;]+/g) ?? [];
    expect(maxWidths.length).toBe(1);
    expect(/max-width:\s*900px/.test(block)).toBe(true);
  });

  it.each(CENTERED_PAGES)('%s wraps content in .dashboard-page', (relativePath) => {
    const source = read(relativePath);
    const hasWrapper = /className=("|')[^"']*\bdashboard-page\b[^"']*("|')/.test(source);
    expect(hasWrapper, `expected .dashboard-page wrapper in ${relativePath}`).toBe(true);
  });
});

// -- Shared filter-control box-model ------------------------------------------

function filterControlBlock(css: string): string {
  const start = css.indexOf('.filter-control');
  expect(start, '.filter-control rule not found in globals.css').toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('.filter-control box-model', () => {
  const block = filterControlBlock(read('app/globals.css'));

  it('neutralizes native chrome and fixes its height', () => {
    expect(block).toMatch(/box-sizing:\s*border-box/);
    expect(block).toMatch(/height:\s*40px/);
    expect(block).toMatch(/appearance:\s*none/);
  });

  it('defines the shared control metrics', () => {
    expect(block).toMatch(/padding:\s*0 12px/);
    expect(block).toMatch(/font-size:\s*13px/);
    expect(block).toMatch(/border-radius:\s*8px/);
  });

  it('jobs-page filter inputs use the shared class with no legacy inline styling', () => {
    const jobs = read('app/(dashboard)/jobs/page.tsx');
    const classMatches = jobs.match(/className="filter-control"/g) ?? [];
    expect(classMatches.length).toBeGreaterThanOrEqual(2);
    expect(jobs).not.toContain("padding: '10px 10px'");
    expect(jobs).not.toContain('padding: "10px 10px"');
    expect(jobs).not.toContain("borderRadius: '7px'");
    expect(jobs).not.toContain('borderRadius: "7px"');
  });
});

// -- Hyperlink styling ----------------------------------------------------------

describe('hyperlink styling', () => {
  it.each(['app/(dashboard)/tailor/page.tsx', 'app/(dashboard)/interview/page.tsx'])(
    '%s contains no inline textDecoration: underline override',
    (relativePath) => {
      const source = read(relativePath);
      expect(source).not.toContain("textDecoration: 'underline'");
      expect(source).not.toContain('textDecoration: "underline"');
    },
  );

  it('globals.css defines a global anchor rule with text-decoration: none', () => {
    expect(/a\s*\{[^}]*text-decoration:\s*none/.test(read('app/globals.css'))).toBe(true);
  });
});

// -- Route-transition skeletons ---------------------------------------------------

const ROUTE_SKELETONS = [
  'app/dashboard/loading.tsx',
  'app/(dashboard)/jobs/loading.tsx',
  'app/(dashboard)/tracker/loading.tsx',
  'app/(dashboard)/apply/loading.tsx',
  'app/(dashboard)/apply/[jobId]/loading.tsx',
  'app/(dashboard)/interview/loading.tsx',
  'app/(dashboard)/networking/loading.tsx',
  'app/(dashboard)/strategy/loading.tsx',
  'app/(dashboard)/tailor/loading.tsx',
  'app/(dashboard)/billing/loading.tsx',
  'app/(dashboard)/documents/loading.tsx',
  'app/(dashboard)/settings/loading.tsx',
  'app/(dashboard)/ats/loading.tsx',
];

describe('route skeletons - full 13-route coverage', () => {
  it('covers all 13 dashboard routes in the scan list', () => {
    expect(ROUTE_SKELETONS.length).toBe(13);
  });

  it.each(ROUTE_SKELETONS)('%s exists', (relativePath) => {
    expect(existsSync(resolve(projectRoot, relativePath))).toBe(true);
  });

  it.each(ROUTE_SKELETONS)('%s composes placeholders from SkeletonLoader', (relativePath) => {
    const source = read(relativePath);
    expect(/import\s+SkeletonLoader\s+from\s+['"][^'"]*SkeletonLoader['"]/.test(source)).toBe(true);
    expect(/<SkeletonLoader\b/.test(source)).toBe(true);
  });

  // The /dashboard landing skeleton is intentionally full-width.
  it.each(ROUTE_SKELETONS.filter((p) => p !== 'app/dashboard/loading.tsx'))(
    '%s roots content in .dashboard-page',
    (relativePath) => {
      const source = read(relativePath);
      expect(/className=("|')[^"']*\bdashboard-page\b[^"']*("|')/.test(source)).toBe(true);
    },
  );

  it.each(ROUTE_SKELETONS)('%s adds no session/first-visit detection logic', (relativePath) => {
    const source = read(relativePath);
    expect(source.includes('sessionStorage')).toBe(false);
    expect(source.includes('localStorage')).toBe(false);
    expect(source.includes('hasVisited')).toBe(false);
  });

  it.each(ROUTE_SKELETONS)('%s marks placeholders decorative via aria-hidden', (relativePath) => {
    expect(/aria-hidden/.test(read(relativePath))).toBe(true);
  });
});

describe('loading + animation regression guards', () => {
  it('app/loading.tsx still renders the root Spinner', () => {
    const source = read('app/loading.tsx');
    expect(/import\s+Spinner\s+from\s+['"][^'"]*Spinner['"]/.test(source)).toBe(true);
    expect(/<Spinner\b/.test(source)).toBe(true);
  });

  it('globals.css keeps the shimmer and fade-in keyframes intact', () => {
    const css = read('app/globals.css');
    expect(/@keyframes\s+shimmer\b/.test(css)).toBe(true);
    expect(/@keyframes\s+fade-in\b/.test(css)).toBe(true);
    expect(/\.fade-in\s*\{/.test(css)).toBe(true);
  });

  it('SkeletonLoader animates with shimmer', () => {
    expect(/animation:\s*['"`]?shimmer\b/.test(read('components/ui/SkeletonLoader.tsx'))).toBe(true);
  });
});
