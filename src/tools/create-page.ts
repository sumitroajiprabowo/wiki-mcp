import type { WikiManager } from '../core/wiki-manager.js';

/** Parameters for creating a new wiki page. */
interface CreatePageInput {
  title: string;
  content: string;
  pageType?: string;
}

/** Delegates page creation to WikiManager, which handles slug generation and file writing. */
export async function handleCreatePage(
  input: CreatePageInput,
  wikiManager: WikiManager,
): Promise<{ success: boolean; path: string; message: string }> {
  return wikiManager.createPage(input.title, input.content, input.pageType);
}
