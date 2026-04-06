import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/server';
import { createServer } from './server.js';
import { handleInit } from './tools/init.js';

/** Semantic version surfaced by --version and the help banner. */
const VERSION = '0.1.0';

/** Multi-line help text printed when the user passes --help. */
const HELP = `llm-wiki-mcp v${VERSION}
MCP server for building and maintaining LLM-powered knowledge wikis.

Usage:
  llm-wiki-mcp [options]          Start the MCP server
  llm-wiki-mcp init [path]        Initialize a new wiki vault

Options:
  -v, --vault <path>          Path to wiki vault (default: current directory)
  -t, --transport <type>      Transport: "stdio" or "http" (default: stdio)
  -p, --port <number>         Port for HTTP transport (default: 3000)
  --help                      Show this help message
  --version                   Show version number

Examples:
  llm-wiki-mcp init ~/my-wiki
  llm-wiki-mcp --vault ~/my-wiki
  llm-wiki-mcp --vault ~/my-wiki --transport http --port 3000

Documentation: https://github.com/sumitroajiprabowo/llm-wiki-mcp`;

/**
 * CLI entry point. Parses arguments and either runs a sub-command (init)
 * or starts the MCP server over the chosen transport (stdio / http).
 */
async function main() {
  const { values, positionals } = parseArgs({
    options: {
      vault: { type: 'string', short: 'v' },
      transport: { type: 'string', short: 't', default: 'stdio' },
      port: { type: 'string', short: 'p', default: '3000' },
      help: { type: 'boolean' },
      version: { type: 'boolean' },
    },
    allowPositionals: true,
    // Allow unknown flags so forward-compat flags don't crash the CLI
    strict: false,
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (values.version) {
    console.log(VERSION);
    process.exit(0);
  }

  // Handle the "init" sub-command: scaffold a new vault then exit
  if (positionals[0] === 'init') {
    const initPath = resolve(positionals[1] ?? '.');
    const result = await handleInit({ path: initPath });
    console.log(result.message);
    for (const f of result.created) {
      console.log(`  + ${f}`);
    }
    process.exit(0);
  }

  // Default vault to the current working directory if not specified
  const vaultPath = resolve(String(values.vault ?? '.'));
  const transportType = String(values.transport ?? 'stdio');

  if (!existsSync(vaultPath)) {
    console.error(`Error: vault path does not exist: ${vaultPath}`);
    console.error(`Run "llm-wiki-mcp init ${vaultPath}" to create a new vault.`);
    process.exit(1);
  }

  // --- Start the MCP server on the chosen transport ---

  if (transportType === 'stdio') {
    const server = await createServer({ vaultPath });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Log to stderr so it doesn't interfere with the stdio JSON-RPC stream
    console.error(`llm-wiki-mcp running (stdio) — vault: ${vaultPath}`);
  } else if (transportType === 'sse' || transportType === 'http') {
    const port = parseInt(String(values.port ?? '3000'), 10);

    // Lazy-import HTTP-only deps so the stdio path stays lightweight
    const { createServer: createHttpServer } = await import('node:http');
    const { NodeStreamableHTTPServerTransport } = await import('@modelcontextprotocol/node');
    const { isInitializeRequest } = await import('@modelcontextprotocol/server');
    const { randomUUID } = await import('node:crypto');

    // Map of active session IDs to their transports for request routing
    const transports: Record<string, InstanceType<typeof NodeStreamableHTTPServerTransport>> = {};

    const httpServer = createHttpServer(async (req, res) => {
      // All MCP traffic is routed through the /mcp endpoint
      if (req.url !== '/mcp') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());

        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        // Route to an existing session if the header matches
        if (sessionId && transports[sessionId]) {
          await transports[sessionId].handleRequest(req, res, body);
          return;
        }

        // First request from a new client — spin up a dedicated server instance
        if (!sessionId && isInitializeRequest(body)) {
          const transport = new NodeStreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id: string) => {
              transports[id] = transport;
            },
          });

          // Clean up the session map when the client disconnects
          transport.onclose = () => {
            if (transport.sessionId) {
              delete transports[transport.sessionId];
            }
          };

          const sessionServer = await createServer({ vaultPath });
          await sessionServer.connect(transport);
          await transport.handleRequest(req, res, body);
          return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Invalid session' },
            id: null,
          }),
        );
      } else if (req.method === 'GET') {
        // GET is used for SSE streaming on an existing session
        const sessionId = req.headers['mcp-session-id'] as string;
        if (sessionId && transports[sessionId]) {
          await transports[sessionId].handleRequest(req, res);
        } else {
          res.writeHead(400);
          res.end('Invalid session');
        }
      } else {
        res.writeHead(405);
        res.end('Method not allowed');
      }
    });

    // Bind to localhost only — external access requires a reverse proxy
    httpServer.listen(port, '127.0.0.1', () => {
      console.error(
        `llm-wiki-mcp running (http) — vault: ${vaultPath} — http://127.0.0.1:${port}/mcp`,
      );
    });
  } else {
    console.error(`Unknown transport: ${transportType}. Use "stdio" or "http".`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
