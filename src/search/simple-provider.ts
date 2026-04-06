import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import type { SearchResult, SearchOptions } from '../config/types.js';
import type { SearchProvider } from './search-provider.js';

/**
 * Zero-dependency fallback search provider.
 * Performs brute-force substring matching over every Markdown file in the wiki.
 * Always available -- used when no indexed provider (e.g., qmd) is installed.
 */
export class SimpleProvider implements SearchProvider {
  name = 'simple';

  /** Always returns true -- no external dependencies required. */
  async available(): Promise<boolean> {
    return true;
  }

  /** No-op: simple provider scans files on each search, so no index is needed. */
  async index(): Promise<void> {
    // no-op
  }

  /**
   * Scores each Markdown file against whitespace-tokenized query terms.
   * Title matches are weighted 3x higher than body occurrences to surface
   * the most relevant pages first.
   */
  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const { maxResults, wikiDir } = options;
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    if (terms.length === 0) return [];

    const files = readdirSync(wikiDir).filter((f) => f.endsWith('.md'));
    const scored: SearchResult[] = [];

    for (const file of files) {
      const absPath = join(wikiDir, file);
      const raw = readFileSync(absPath, 'utf-8');
      const parsed = matter(raw);
      const title = (parsed.data.title as string) ?? file.replace('.md', '');
      const body = parsed.content.toLowerCase();
      const titleLower = title.toLowerCase();

      let score = 0;
      let matchedSnippet = '';

      for (const term of terms) {
        // Title matches are worth 3 points to prioritize exact-topic pages
        if (titleLower.includes(term)) {
          score += 3;
        }

        const bodyMatches = body.split(term).length - 1;
        score += bodyMatches;

        // Capture a context window around the first body match for the snippet
        if (!matchedSnippet && bodyMatches > 0) {
          const idx = body.indexOf(term);
          const start = Math.max(0, idx - 50);
          const end = Math.min(body.length, idx + term.length + 100);
          // Slice from the original (non-lowered) content to preserve casing
          matchedSnippet = parsed.content.slice(start, end).trim();
        }
      }

      if (score > 0) {
        scored.push({
          path: file,
          title,
          snippet: matchedSnippet,
          // Normalize to 0-1 range; 5 is the assumed max points per term
          score: Math.min(score / (terms.length * 5), 1),
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults);
  }
}
