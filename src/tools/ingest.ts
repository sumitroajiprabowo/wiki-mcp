import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { WikiSchema } from '../config/types.js';
import { safePath } from '../utils/safe-path.js';

/** Parameters for ingesting a raw source document. */
interface IngestInput {
  source_path: string;
}

/**
 * Everything the LLM needs to turn a raw source into wiki pages:
 * the source content, a list of pages that already exist (to avoid duplicates),
 * and the schema rules (page types and link style) to follow.
 */
interface IngestOutput {
  content: string;
  existing_pages: string[];
  schema: {
    pageTypes: WikiSchema['pageTypes'];
    linkStyle: WikiSchema['linkStyle'];
  };
}

/**
 * Reads a raw source file and returns it alongside wiki context.
 * The caller (typically an LLM) uses this context to split the source into wiki pages.
 */
export async function handleIngest(
  input: IngestInput,
  vaultPath: string,
  schema: WikiSchema,
): Promise<IngestOutput> {
  // safePath prevents path-traversal attacks (e.g. "../../etc/passwd")
  const absPath = safePath(vaultPath, input.source_path);

  if (!existsSync(absPath)) {
    throw new Error(`Source not found: ${input.source_path}`);
  }

  const content = readFileSync(absPath, 'utf-8');

  // Collect existing wiki pages so the LLM can avoid creating duplicates
  const wikiDir = join(vaultPath, schema.paths.wiki);
  let existingPages: string[] = [];

  if (existsSync(wikiDir)) {
    existingPages = readdirSync(wikiDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => `${schema.paths.wiki}/${f}`);
  }

  return {
    content,
    existing_pages: existingPages,
    schema: {
      pageTypes: schema.pageTypes,
      linkStyle: schema.linkStyle,
    },
  };
}
