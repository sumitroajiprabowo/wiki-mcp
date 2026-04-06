// src/core/link-resolver.ts
import type { ParsedLink } from '../config/types.js';

/** Matches `[[Target]]` or `[[Target|Display]]` wikilinks. */
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
/** Matches standard `[text](url)` Markdown links. */
const MDLINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Creates and parses inter-page links in either wikilink (`[[…]]`) or
 * standard Markdown (`[…](…)`) style, depending on user configuration.
 */
export class LinkResolver {
  constructor(
    private linkStyle: 'wikilink' | 'markdown',
    /** Relative directory used as the base path when generating Markdown-style links. */
    private wikiDir: string,
  ) {}

  /** Converts a page title into a URL-safe slug for use in file names and paths. */
  slugify(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /** Generates a link string pointing to the given page title, using the configured link style. */
  createLink(targetTitle: string, displayText?: string): string {
    if (this.linkStyle === 'wikilink') {
      if (displayText) {
        return `[[${targetTitle}|${displayText}]]`;
      }
      return `[[${targetTitle}]]`;
    }

    const slug = this.slugify(targetTitle);
    const path = `${this.wikiDir}/${slug}.md`;
    const text = displayText ?? targetTitle;
    return `[${text}](${path})`;
  }

  /** Extracts all inter-page links from the given Markdown content. */
  parseLinks(content: string): ParsedLink[] {
    const links: ParsedLink[] = [];

    if (this.linkStyle === 'wikilink') {
      let match: RegExpExecArray | null;
      const regex = new RegExp(WIKILINK_REGEX.source, 'g');
      while ((match = regex.exec(content)) !== null) {
        links.push({
          raw: match[0],
          target: match[1],
          displayText: match[2] ?? undefined,
        });
      }
    } else {
      let match: RegExpExecArray | null;
      // Fresh regex instance to avoid stale `lastIndex` from the module-level constant
      const regex = new RegExp(MDLINK_REGEX.source, 'g');
      while ((match = regex.exec(content)) !== null) {
        links.push({
          raw: match[0],
          target: match[1],
          displayText: undefined,
        });
      }
    }

    return links;
  }
}
