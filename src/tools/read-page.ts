import type { WikiManager } from '../core/wiki-manager.js';
import type { PageData } from '../config/types.js';

/** Lookup by title, by path, or both. At least one must be provided. */
interface ReadPageInput {
  title?: string;
  path?: string;
}

/** Retrieves a single wiki page by title or direct path. */
export async function handleReadPage(
  input: ReadPageInput,
  wikiManager: WikiManager,
): Promise<PageData> {
  return wikiManager.readPage(input);
}
