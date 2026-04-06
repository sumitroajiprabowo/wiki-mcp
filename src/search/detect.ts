import type { SearchProvider } from './search-provider.js';
import { QmdProvider } from './qmd-provider.js';
import { SimpleProvider } from './simple-provider.js';

/**
 * Detects the best available search provider at runtime.
 * Prefers `qmd` (full-text indexed search) when installed;
 * falls back to the built-in simple provider otherwise.
 */
export async function detectSearchProvider(): Promise<SearchProvider> {
  const qmd = new QmdProvider();

  if (await qmd.available()) {
    return qmd;
  }

  return new SimpleProvider();
}
