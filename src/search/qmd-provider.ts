import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SearchResult, SearchOptions } from '../config/types.js';
import type { SearchProvider } from './search-provider.js';

const execFileAsync = promisify(execFile);

/**
 * Search provider backed by the `qmd` CLI tool.
 * `qmd` provides fast full-text indexed search over Markdown files.
 * Only usable when the `qmd` binary is installed on the host system.
 */
export class QmdProvider implements SearchProvider {
  name = 'qmd';

  /** Checks whether the `qmd` binary exists on PATH. */
  async available(): Promise<boolean> {
    try {
      await execFileAsync('which', ['qmd']);
      return true;
    } catch {
      return false;
    }
  }

  /** Rebuilds the qmd search index for the given wiki directory. */
  async index(wikiDir: string): Promise<void> {
    try {
      await execFileAsync('qmd', ['index', '--dir', wikiDir]);
    } catch (err) {
      throw new Error(`qmd index failed: ${err}`);
    }
  }

  /** Delegates search to the qmd CLI and normalizes its JSON output. */
  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const { maxResults, wikiDir } = options;

    try {
      const { stdout } = await execFileAsync('qmd', [
        'search',
        query,
        '--dir',
        wikiDir,
        '--limit',
        String(maxResults),
        '--json',
      ]);

      const parsed = JSON.parse(stdout);

      if (!Array.isArray(parsed)) return [];

      // Map qmd's output shape to our internal SearchResult type.
      // Falls back to `content` when `snippet` is absent (older qmd versions).
      return parsed.map((item: Record<string, unknown>) => ({
        path: String(item.path ?? ''),
        title: String(item.title ?? ''),
        snippet: String(item.snippet ?? item.content ?? ''),
        score: Number(item.score ?? 0),
      }));
    } catch {
      return [];
    }
  }
}
