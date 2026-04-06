import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { DEFAULT_SCHEMA, type WikiSchema } from '../config/types.js';

/** Parameters for initializing a new wiki vault. */
interface InitInput {
  path: string;
  name?: string;
  linkStyle?: 'wikilink' | 'markdown';
}

/** Summary of what the init operation created (or skipped). */
interface InitOutput {
  success: boolean;
  message: string;
  created: string[];
}

/**
 * Scaffolds a new wiki vault: creates directories, writes the schema file,
 * and seeds index.md and log.md. Safe to call on an existing vault -- it
 * will bail out without overwriting if the schema file already exists.
 */
export async function handleInit(input: InitInput): Promise<InitOutput> {
  const { path: vaultPath, name, linkStyle } = input;
  const schemaPath = join(vaultPath, '.wiki-schema.yaml');

  // Idempotency guard: never overwrite an existing vault
  if (existsSync(schemaPath)) {
    return {
      success: true,
      message: 'Vault already initialized — skipping without overwrite.',
      created: [],
    };
  }

  const schema: WikiSchema = {
    ...DEFAULT_SCHEMA,
    name: name ?? DEFAULT_SCHEMA.name,
    linkStyle: linkStyle ?? DEFAULT_SCHEMA.linkStyle,
  };

  const created: string[] = [];

  const dirs = [schema.paths.raw, schema.paths.assets, schema.paths.wiki];

  for (const dir of dirs) {
    const absDir = join(vaultPath, dir);
    if (!existsSync(absDir)) {
      mkdirSync(absDir, { recursive: true });
      created.push(dir + '/');
    }
  }

  // lineWidth: -1 disables line wrapping so paths and values stay on one line
  const yamlContent = yaml.dump(schema, { lineWidth: -1 });
  writeFileSync(schemaPath, yamlContent, 'utf-8');
  created.push('.wiki-schema.yaml');

  const indexPath = join(vaultPath, 'index.md');
  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, '# Wiki Index\n', 'utf-8');
    created.push('index.md');
  }

  const logPath = join(vaultPath, 'log.md');
  if (!existsSync(logPath)) {
    const today = new Date().toISOString().slice(0, 10);
    const logContent = `# Wiki Log\n\n## [${today}] init | ${schema.name}\nVault initialized.\n`;
    writeFileSync(logPath, logContent, 'utf-8');
    created.push('log.md');
  }

  return {
    success: true,
    message: `Vault initialized at ${vaultPath}`,
    created,
  };
}
