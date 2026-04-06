import type { WikiManager } from '../core/wiki-manager.js';

/** Parameters for updating an existing wiki page. */
interface UpdatePageInput {
  path: string;
  content: string;
}

/** Overwrites a wiki page's content (including frontmatter) at the given path. */
export async function handleUpdatePage(
  input: UpdatePageInput,
  wikiManager: WikiManager,
): Promise<{ success: boolean; path: string; message: string }> {
  return wikiManager.updatePage(input.path, input.content);
}
