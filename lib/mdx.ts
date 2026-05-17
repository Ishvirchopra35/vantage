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

function splitChangelogEntries(source: string): Array<{ frontmatter: string; content: string }> {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const results: Array<{ frontmatter: string; content: string }> = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim() !== '---') { i++; continue; }
    i++; // skip opening ---

    // Read frontmatter until closing ---
    const fmLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '---') {
      fmLines.push(lines[i]);
      i++;
    }
    i++; // skip closing ---

    // Read content until next opening ---
    const contentLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '---') {
      contentLines.push(lines[i]);
      i++;
    }

    results.push({
      frontmatter: fmLines.join('\n'),
      content: contentLines.join('\n').trim(),
    });
  }

  return results;
}

export async function getChangelog(): Promise<ChangelogEntry[]> {
  const files = await readMdxFiles(CHANGELOG_DIR);
  const allEntries: ChangelogEntry[] = [];

  for (const fileName of files) {
    const fullPath = path.join(CHANGELOG_DIR, fileName);
    const source = await fs.readFile(fullPath, 'utf8');
    const blocks = splitChangelogEntries(source);

    for (const block of blocks) {
      try {
        const parsed = matter(`---\n${block.frontmatter}\n---`);
        if (!isRecord(parsed.data)) continue;

        allEntries.push({
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
  }

  return sortByDateDesc(allEntries);
}
