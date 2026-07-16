// SERVER-SIDE ONLY - loads and validates MDX content for the public blog
// (/content/blog) and changelog (/content/changelog). Frontmatter is
// validated strictly: a malformed post fails the build, not the reader.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const CHANGELOG_DIR = path.join(process.cwd(), 'content', 'changelog');

type BlogCategory = 'Product' | 'Research' | 'Company' | 'News' | 'Insights';
type ChangelogType = 'Feature' | 'Update' | 'Fix' | 'Improvement' | 'Major Release';

export interface BlogPost {
  title: string;
  date: string;
  category: BlogCategory;
  author: string;
  readTime: string;
  excerpt: string;
  slug: string;
}

export interface ChangelogEntry {
  date: string;
  version?: string;
  type: ChangelogType;
  title: string;
  summary: string;
  content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringField(data: Record<string, unknown>, field: string): string {
  const raw = data[field];
  // js-yaml parses unquoted YYYY-MM-DD values as Date objects
  const value = raw instanceof Date ? raw.toISOString().split('T')[0] : raw;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid frontmatter: ${field} must be a non-empty string.`);
  }
  return value;
}

function getOptionalStringField(data: Record<string, unknown>, field: string): string | undefined {
  const value = data[field];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`Invalid frontmatter: ${field} must be a string when provided.`);
  }
  return value;
}

function getEnumField<T extends string>(
  data: Record<string, unknown>,
  field: string,
  allowed: readonly T[]
): T {
  const value = getStringField(data, field);
  if (!allowed.includes(value as T)) {
    throw new Error(`Invalid frontmatter: ${field} must be one of ${allowed.join(', ')}.`);
  }
  return value as T;
}

async function readMdxFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((name) => name.endsWith('.mdx'));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function sortByDateDesc<T extends { date: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const files = await readMdxFiles(BLOG_DIR);

  const posts = await Promise.all(
    files.map(async (fileName) => {
      const fullPath = path.join(BLOG_DIR, fileName);
      const source = await fs.readFile(fullPath, 'utf8');
      const parsed = matter(source);

      if (!isRecord(parsed.data)) {
        throw new Error(`Invalid frontmatter in ${fileName}.`);
      }

      const slug = fileName.replace(/\.mdx$/, '');

      return {
        title: getStringField(parsed.data, 'title'),
        date: getStringField(parsed.data, 'date'),
        category: getEnumField(parsed.data, 'category', [
          'Product',
          'Research',
          'Company',
          'News',
          'Insights',
        ]),
        author: getStringField(parsed.data, 'author'),
        readTime: getStringField(parsed.data, 'readTime'),
        excerpt: getStringField(parsed.data, 'excerpt'),
        slug,
      } satisfies BlogPost;
    })
  );

  return sortByDateDesc(posts);
}

export async function getBlogPost(
  slug: string
): Promise<{ frontmatter: BlogPost; content: string }> {
  const fullPath = path.join(BLOG_DIR, `${slug}.mdx`);
  const source = await fs.readFile(fullPath, 'utf8');
  const parsed = matter(source);

  if (!isRecord(parsed.data)) {
    throw new Error(`Invalid frontmatter in ${slug}.mdx.`);
  }

  const frontmatter: BlogPost = {
    title: getStringField(parsed.data, 'title'),
    date: getStringField(parsed.data, 'date'),
    category: getEnumField(parsed.data, 'category', [
      'Product',
      'Research',
      'Company',
      'News',
      'Insights',
    ]),
    author: getStringField(parsed.data, 'author'),
    readTime: getStringField(parsed.data, 'readTime'),
    excerpt: getStringField(parsed.data, 'excerpt'),
    slug,
  };

  return { frontmatter, content: parsed.content };
}

// A frontmatter key line, e.g. `date:`, `  version:`, `title:`. Allows leading
// whitespace and hyphenated keys, but the first char must be a letter/underscore
// (so body bullets like `- foo: bar` are never mistaken for frontmatter).
const FRONTMATTER_KEY_LINE = /^\s*[A-Za-z_][\w-]*\s*:/;
// Every well-formed entry's frontmatter leads with a `date:` key. This is the
// invariant used to detect entry boundaries independent of the closing fence.
const DATE_KEY_LINE = /^date\s*:/;

/**
 * Returns true when the first non-blank line at or after `startIndex` is a
 * `date:` frontmatter key — i.e. the preceding `---` opens a new entry rather
 * than closing the current one's frontmatter.
 */
function nextNonBlankIsDateKey(lines: string[], startIndex: number): boolean {
  for (let j = startIndex; j < lines.length; j++) {
    const trimmed = lines[j].trim();
    if (trimmed === '') continue;
    return DATE_KEY_LINE.test(trimmed);
  }
  return false;
}

/**
 * Splits a changelog MDX file into raw entry blocks.
 *
 * Entry-boundary detection is decoupled from the frontmatter fence: a boundary
 * is a line equal to `---` whose next non-blank line is a `date:` key. This
 * tolerates entries that omit their `summary` and/or their closing `---` fence
 * (body content sitting directly under the frontmatter keys) without letting
 * body text leak into YAML or letting one malformed entry consume the next.
 */
function splitChangelogEntries(source: string): Array<{ frontmatter: string; content: string }> {
  const lines = source.replace(/\r\n/g, '\n').split('\n');

  // Locate entry boundaries. The file's leading `---` is the first one.
  const boundaries: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---' && nextNonBlankIsDateKey(lines, i + 1)) {
      boundaries.push(i);
    }
  }

  const results: Array<{ frontmatter: string; content: string }> = [];

  for (let b = 0; b < boundaries.length; b++) {
    const start = boundaries[b] + 1; // skip the boundary `---` itself
    const end = b + 1 < boundaries.length ? boundaries[b + 1] : lines.length;
    const chunk = lines.slice(start, end);

    // Separate frontmatter from body. The frontmatter is the leading run of
    // key lines (blank lines allowed between keys). The run ends at the first
    // closing `---` fence (consumed) OR the first non-blank, non-key line
    // (not consumed — it begins the body).
    const frontmatterLines: string[] = [];
    let k = 0;
    for (; k < chunk.length; k++) {
      const line = chunk[k];
      if (line.trim() === '---') {
        k++; // consume the closing fence
        break;
      }
      if (line.trim() === '' || FRONTMATTER_KEY_LINE.test(line)) {
        frontmatterLines.push(line);
        continue;
      }
      break; // first non-blank, non-key line — body starts here, do not consume
    }

    results.push({
      frontmatter: frontmatterLines.join('\n').trim(),
      content: chunk.slice(k).join('\n').trim(),
    });
  }

  return results;
}

/**
 * Parses a single changelog MDX source string into changelog entries.
 *
 * Pure (filesystem-free) so the parsing logic can be exercised over generated
 * inputs. `getChangelog()` delegates to this for every on-disk file, so its
 * behavior is unchanged. Splits the source into entry blocks, reconstructs and
 * validates each block's frontmatter in isolation (a malformed block is skipped
 * without affecting siblings), defaults a missing `summary` to `''`, and returns
 * the entries sorted newest-first.
 */
export function parseChangelogSource(source: string): ChangelogEntry[] {
  const blocks = splitChangelogEntries(source);
  const entries: ChangelogEntry[] = [];

  for (const block of blocks) {
    try {
      const parsed = matter(`---\n${block.frontmatter}\n---`);
      if (!isRecord(parsed.data)) continue;

      entries.push({
        date: getStringField(parsed.data, 'date'),
        version: getOptionalStringField(parsed.data, 'version'),
        type: getEnumField(parsed.data, 'type', [
          'Feature',
          'Update',
          'Fix',
          'Improvement',
          'Major Release',
        ]),
        title: getStringField(parsed.data, 'title'),
        summary: getOptionalStringField(parsed.data, 'summary') ?? '',
        content: block.content,
      } satisfies ChangelogEntry);
    } catch {
      continue;
    }
  }

  return sortByDateDesc(entries);
}

export async function getChangelog(): Promise<ChangelogEntry[]> {
  const files = await readMdxFiles(CHANGELOG_DIR);
  const allEntries: ChangelogEntry[] = [];

  for (const fileName of files) {
    const fullPath = path.join(CHANGELOG_DIR, fileName);
    const source = await fs.readFile(fullPath, 'utf8');
    allEntries.push(...parseChangelogSource(source));
  }

  return sortByDateDesc(allEntries);
}
