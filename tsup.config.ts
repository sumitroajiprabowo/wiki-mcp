import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { server: "src/server.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
    target: "node20",
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    target: "node20",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
