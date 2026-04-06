import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import type { WikiSchema } from '../config/types.js';
import type { LinkResolver } from '../core/link-resolver.js';

/** Parameters for the lint operation. "recent" scope is reserved for future incremental checks. */
interface LintInput {
  scope?: 'full' | 'recent';
}

/** A directed link that points to a non-existent page. */
interface BrokenLink {
  from: string;
  to: string;
}

/** Comprehensive health-check results for the wiki vault. */
interface LintOutput {
  orphan_pages: string[];
  broken_links: BrokenLink[];
  missing_pages: string[];
  pages_without_frontmatter: string[];
  stale_index_entries: string[];
}

/**
 * Performs a full health-check of the wiki vault by scanning every page
 * for structural issues: orphans, broken links, missing frontmatter,
 * and stale index entries. Returns all findings in a single report.
 */
export async function handleLint(
  input: LintInput,
  vaultPath: string,
  schema: WikiSchema,
  linkResolver: LinkResolver,
): Promise<LintOutput> {
  const wikiDir = join(vaultPath, schema.paths.wiki);

  if (!existsSync(wikiDir)) {
    return {
      orphan_pages: [],
      broken_links: [],
      missing_pages: [],
      pages_without_frontmatter: [],
      stale_index_entries: [],
    };
  }

  const files = readdirSync(wikiDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => `${schema.paths.wiki}/${f}`);

  // First pass: build lookup maps and record all inbound link targets
  const titleToPath = new Map<string, string>();
  const pathToTitle = new Map<string, string>();
  const inboundLinks = new Set<string>();
  const brokenLinks: BrokenLink[] = [];
  const pagesWithoutFrontmatter: string[] = [];

  for (const file of files) {
    const absPath = join(vaultPath, file);
    const raw = readFileSync(absPath, 'utf-8');
    const parsed = matter(raw);

    // Fall back to the filename (without extension) when frontmatter has no title
    const title = (parsed.data.title as string) ?? file.replace(/.*\//, '').replace('.md', '');
    titleToPath.set(title, file);
    pathToTitle.set(file, title);

    if (Object.keys(parsed.data).length === 0) {
      pagesWithoutFrontmatter.push(file);
    }

    const links = linkResolver.parseLinks(raw);
    for (const link of links) {
      inboundLinks.add(link.target);
    }
  }

  // Second pass: identify orphans (pages no other page links to)
  const orphanPages: string[] = [];
  const missingPagesSet = new Set<string>();

  for (const file of files) {
    const title = pathToTitle.get(file)!;
    if (!inboundLinks.has(title)) {
      orphanPages.push(file);
    }
  }

  // Third pass: detect broken links (targets that don't resolve to any existing page)
  for (const file of files) {
    const absPath = join(vaultPath, file);
    const raw = readFileSync(absPath, 'utf-8');
    const links = linkResolver.parseLinks(raw);

    for (const link of links) {
      if (!titleToPath.has(link.target)) {
        brokenLinks.push({ from: file, to: link.target });
        missingPagesSet.add(link.target);
      }
    }
  }

  // Check the root index for links that point to deleted or renamed pages
  const staleIndexEntries: string[] = [];
  const indexPath = join(vaultPath, 'index.md');
  if (existsSync(indexPath)) {
    const indexContent = readFileSync(indexPath, 'utf-8');
    const indexLinks = linkResolver.parseLinks(indexContent);
    for (const link of indexLinks) {
      if (!titleToPath.has(link.target)) {
        staleIndexEntries.push(link.target);
      }
    }
  }

  return {
    orphan_pages: orphanPages,
    broken_links: brokenLinks,
    missing_pages: Array.from(missingPagesSet),
    pages_without_frontmatter: pagesWithoutFrontmatter,
    stale_index_entries: staleIndexEntries,
  };
}
