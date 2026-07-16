import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Marketing-surface invariants: the scroll-reveal system, its scoping, and the
// sticky header's theme tokens. jsdom cannot reproduce IntersectionObserver or
// stylesheet-derived state, so these assert against source files directly.

const projectRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), 'utf8');
}

function findMarketingPages(): string[] {
  const marketingRoot = resolve(projectRoot, 'app/(marketing)');
  const pages: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'page.tsx') pages.push(full);
    }
  }
  walk(marketingRoot);
  return pages;
}

describe('reveal CSS (app/globals.css)', () => {
  const css = read('app/globals.css');

  it('.reveal defines opacity: 0 and a 0.5s ease-out transition', () => {
    const revealBlock = css.match(/\.reveal\s*\{[^}]*\}/);
    expect(revealBlock, 'expected a `.reveal { ... }` rule in globals.css').not.toBeNull();
    expect(revealBlock![0]).toMatch(/opacity:\s*0\b/);
    expect(revealBlock![0]).toMatch(/0\.5s\s+ease-out/);
  });

  it('per-direction classes each declare a transform offset', () => {
    expect(css).toMatch(/\.reveal-up\s*\{[^}]*transform:[^}]*translateY\(/);
    expect(css).toMatch(/\.reveal-left\s*\{[^}]*transform:[^}]*translateX\(/);
    expect(css).toMatch(/\.reveal-right\s*\{[^}]*transform:[^}]*translateX\(/);
    expect(css).toMatch(/\.reveal-scale\s*\{[^}]*transform:[^}]*scale\(/);
  });

  it('.reveal.revealed resolves to opacity: 1 and transform: none', () => {
    const revealedBlock = css.match(/\.reveal\.revealed\s*\{[^}]*\}/);
    expect(revealedBlock, 'expected a `.reveal.revealed { ... }` rule').not.toBeNull();
    expect(revealedBlock![0]).toMatch(/opacity:\s*1\b/);
    expect(revealedBlock![0]).toMatch(/transform:\s*none\b/);
  });

  it('prefers-reduced-motion forces reveal selectors to their final state', () => {
    const rmBlocks = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/g);
    expect(rmBlocks, 'expected a prefers-reduced-motion media block').not.toBeNull();
    const revealRm = rmBlocks!.find((b) => /\.reveal\b/.test(b));
    expect(revealRm, 'expected a reduced-motion block targeting .reveal').toBeDefined();
    for (const cls of ['.reveal-up', '.reveal-left', '.reveal-right', '.reveal-scale']) {
      expect(revealRm).toContain(cls);
    }
    expect(revealRm).toMatch(/opacity:\s*1\b/);
    expect(revealRm).toMatch(/transform:\s*none\b/);
    expect(revealRm).toMatch(/transition:\s*none\b/);
  });
});

describe('no external animation library', () => {
  it('components/marketing/Reveal.tsx uses the native IntersectionObserver API', () => {
    expect(read('components/marketing/Reveal.tsx')).toContain('IntersectionObserver');
  });

  it('package.json declares no external animation library', () => {
    const pkg = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const banned = [
      'framer-motion',
      'motion',
      'gsap',
      'react-spring',
      '@react-spring/web',
      'aos',
      'animejs',
      'anime.js',
    ];
    for (const lib of banned) {
      expect(allDeps, `unexpected animation library "${lib}" in package.json`).not.toHaveProperty(lib);
    }
  });
});

describe('reveal scoping - marketing home page only', () => {
  const homePagePath = resolve(projectRoot, 'app/(marketing)/page.tsx');

  it('the home page imports Reveal', () => {
    expect(readFileSync(homePagePath, 'utf8')).toMatch(
      /import\s+Reveal\s+from\s+['"]@\/components\/marketing\/Reveal['"]/,
    );
  });

  it('no other marketing page imports Reveal', () => {
    const pages = findMarketingPages();
    expect(pages.length).toBeGreaterThan(1);

    const others = pages
      .filter((p) => p !== homePagePath)
      .filter((p) => /components\/marketing\/Reveal/.test(readFileSync(p, 'utf8')));

    expect(
      others,
      `only the home page may import Reveal, but these also do: ${others.join(', ')}`,
    ).toEqual([]);
  });

  it('the hero renders before (outside) the first Reveal wrapper', () => {
    // The hero must be visible instantly - never gated behind a scroll reveal.
    const source = readFileSync(homePagePath, 'utf8');
    const firstSection = source.indexOf('<section');
    const firstReveal = source.indexOf('<Reveal');
    expect(firstSection).toBeGreaterThan(-1);
    expect(firstReveal).toBeGreaterThan(-1);
    expect(firstSection).toBeLessThan(firstReveal);
  });
});

describe('marketing header theme tokens', () => {
  const NAV_PATH = 'components/marketing/MarketingNav.tsx';

  it('MarketingNav consumes var(--nav-bg) and var(--nav-border)', () => {
    const source = read(NAV_PATH);
    expect(source).toContain('var(--nav-bg)');
    expect(source).toContain('var(--nav-border)');
  });

  it('MarketingNav retains no hardcoded rgba(10,10,10 dark-nav literal', () => {
    const source = read(NAV_PATH);
    expect(source).not.toContain('rgba(10,10,10');
    expect(source).not.toContain('rgba(10, 10, 10');
  });
});
