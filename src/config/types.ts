/**
 * Top-level vault configuration, typically stored in `.wiki-schema.yaml`.
 * All fields have sensible defaults defined in `DEFAULT_SCHEMA`.
 */
export interface WikiSchema {
  /** Display name of the wiki vault. */
  name: string;
  /** Schema version — reserved for future migration logic. */
  version: number;
  /** How inter-page links are formatted: Obsidian-style `[[wikilink]]` or standard `[markdown](url)`. */
  linkStyle: 'wikilink' | 'markdown';
  /** Relative directory paths within the vault. */
  paths: {
    /** Where raw source documents (PDFs, text files, etc.) are stored. */
    raw: string;
    /** Where generated wiki pages live. */
    wiki: string;
    /** Where binary assets (images, diagrams) are kept. */
    assets: string;
  };
  /** Registry of allowed page types, each with its own required frontmatter fields. */
  pageTypes: Record<string, PageTypeConfig>;
  /** Tagging rules for wiki pages. */
  tags: {
    /** If true, every page must have at least one tag. */
    required: boolean;
    /** Suggested tags shown to LLMs when creating pages. */
    suggested: string[];
  };
  /** Configuration for the append-only changelog. */
  log: {
    /** Template string for each log entry heading. Supports `{date}`, `{operation}`, `{title}`. */
    prefix: string;
  };
}

/** Defines a category of wiki page (e.g., "concept", "entity"). */
export interface PageTypeConfig {
  /** Human-readable explanation of what this page type represents. */
  description: string;
  /** Frontmatter keys that must be present for this page type. */
  requiredFields: string[];
}

/** A single row in the wiki's auto-generated index file. */
export interface IndexEntry {
  title: string;
  path: string;
  pageType: string;
  summary: string;
}

/** A structured entry in the vault's changelog. */
export interface LogEntry {
  date: string;
  operation: string;
  title: string;
  details?: string;
}

/** Filters for querying the changelog. All fields are optional. */
export interface LogFilter {
  /** Only include entries matching this operation (e.g., "create", "update"). */
  operation?: string;
  /** ISO-8601 date string — exclude entries older than this. */
  since?: string;
  /** Maximum number of entries to return. */
  limit?: number;
}

/** A parsed internal link extracted from page content. */
export interface ParsedLink {
  /** The original raw text of the link as it appears in Markdown. */
  raw: string;
  /** The resolved target path or page title the link points to. */
  target: string;
  /** Optional display text that differs from the target. */
  displayText?: string;
}

/** A single result returned by the search provider. */
export interface SearchResult {
  path: string;
  title: string;
  /** Short excerpt around the matching text. */
  snippet: string;
  /** Relevance score — higher is better. */
  score: number;
}

/** Options passed to the search provider. */
export interface SearchOptions {
  maxResults: number;
  /** Absolute path to the wiki directory to search within. */
  wikiDir: string;
}

/** Represents a wiki page read from disk, including its parsed frontmatter. */
export interface PageData {
  /** Full Markdown content (including frontmatter block). */
  content: string;
  /** Parsed YAML frontmatter as key-value pairs. */
  frontmatter: Record<string, unknown>;
  /** Relative path of the page within the wiki directory. */
  path: string;
}

/**
 * Sensible defaults used when a vault has no `.wiki-schema.yaml`
 * or when the config file omits certain fields.
 */
export const DEFAULT_SCHEMA: WikiSchema = {
  name: 'My Wiki',
  version: 1,
  linkStyle: 'wikilink',
  paths: {
    raw: 'raw',
    wiki: 'wiki',
    assets: 'raw/assets',
  },
  pageTypes: {
    source: {
      description: 'Summary of a raw source document',
      requiredFields: ['title', 'type', 'source_path', 'created'],
    },
    concept: {
      description: 'A concept or idea',
      requiredFields: ['title', 'type', 'tags', 'created'],
    },
    entity: {
      description: 'A person, organization, or thing',
      requiredFields: ['title', 'type', 'tags', 'created'],
    },
    comparison: {
      description: 'Comparison between concepts/entities',
      requiredFields: ['title', 'type', 'subjects', 'created'],
    },
  },
  tags: {
    required: false,
    suggested: [],
  },
  log: {
    prefix: '## [{date}] {operation} | {title}',
  },
};
