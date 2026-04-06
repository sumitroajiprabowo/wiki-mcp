// src/core/log-manager.ts
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LogEntry, LogFilter } from '../config/types.js';

/** Markdown header written at the top of a new log file. */
const LOG_HEADER = '# Wiki Log\n';
/** Parses a log entry heading: `## [YYYY-MM-DD] operation | title` */
const ENTRY_REGEX = /^## \[(\d{4}-\d{2}-\d{2})\] (\w+) \| (.+)$/;

/**
 * Append-only log stored as a human-readable Markdown file (`log.md`).
 *
 * Each operation (create, update, delete) is recorded as a timestamped
 * entry so users can audit changes without relying on git history.
 */
export class LogManager {
  private logPath: string;

  constructor(vaultPath: string) {
    this.logPath = join(vaultPath, 'log.md');
  }

  /** Appends a single log entry to the end of the log file, creating the file if needed. */
  async append(entry: LogEntry): Promise<void> {
    if (!existsSync(this.logPath)) {
      writeFileSync(this.logPath, LOG_HEADER + '\n', 'utf-8');
    }

    let block = `\n## [${entry.date}] ${entry.operation} | ${entry.title}\n`;
    if (entry.details) {
      block += `${entry.details}\n`;
    }

    appendFileSync(this.logPath, block, 'utf-8');
  }

  /** Reads and optionally filters log entries. Filters are applied in order: operation, since, limit. */
  async read(filter?: LogFilter): Promise<LogEntry[]> {
    if (!existsSync(this.logPath)) {
      return [];
    }

    const content = readFileSync(this.logPath, 'utf-8');
    const lines = content.split('\n');
    const entries: LogEntry[] = [];
    let current: LogEntry | null = null;
    const detailLines: string[] = [];

    // Flush accumulates detail lines into the current entry before moving on
    const flushCurrent = () => {
      if (current) {
        if (detailLines.length > 0) {
          current.details = detailLines.join('\n').trim() || undefined;
        }
        entries.push(current);
        detailLines.length = 0;
      }
    };

    for (const line of lines) {
      const match = line.match(ENTRY_REGEX);
      if (match) {
        flushCurrent();
        current = {
          date: match[1],
          operation: match[2],
          title: match[3],
        };
      } else if (current && line.trim() !== '' && !line.startsWith('# ')) {
        detailLines.push(line);
      }
    }
    flushCurrent();

    let result = entries;

    if (filter?.operation) {
      result = result.filter((e) => e.operation === filter.operation);
    }
    if (filter?.since) {
      result = result.filter((e) => e.date >= filter.since!);
    }
    if (filter?.limit) {
      // Keep the most recent N entries (tail), not the oldest
      result = result.slice(-filter.limit);
    }

    return result;
  }
}
