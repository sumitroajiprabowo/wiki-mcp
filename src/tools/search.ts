import type { SearchProvider } from '../search/search-provider.js';
import type { SearchResult } from '../config/types.js';

/** Parameters for a wiki search query. */
interface SearchInput {
  query: string;
  max_results?: number;
}

/** Wrapper around raw search results for consistent tool output shape. */
interface SearchOutput {
  results: SearchResult[];
}

/** Runs a text or semantic search across all wiki pages. */
export async function handleSearch(
  input: SearchInput,
  searchProvider: SearchProvider,
  wikiDir: string,
): Promise<SearchOutput> {
  const maxResults = input.max_results ?? 10;

  const results = await searchProvider.search(input.query, {
    maxResults,
    wikiDir,
  });

  return { results };
}
