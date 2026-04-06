import type { SearchResult, SearchOptions } from '../config/types.js';

/**
 * Contract every search backend must implement.
 * New providers (e.g., SQLite FTS, Tantivy) just need to satisfy this interface.
 */
export interface SearchProvider {
  /** Human-readable identifier for logging and diagnostics. */
  name: string;

  /** Returns true if this provider's external dependencies are present. */
  available(): Promise<boolean>;

  /** Builds or refreshes the search index for the given wiki directory. */
  index(wikiDir: string): Promise<void>;

  /** Executes a search query and returns ranked results. */
  search(query: string, options: SearchOptions): Promise<SearchResult[]>;
}
