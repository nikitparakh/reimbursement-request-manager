import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// NOTE: do NOT enable `config.default.minify`. On Next 16.2 + OpenNext 1.19.x,
// esbuild minification breaks OpenNext's `loadCustomCacheHandlers` patch
// (renames the function params while the injected cache-handler code still
// references the original names) -> `ReferenceError: t is not defined` at
// getIncrementalCache -> every request 500s. The `next build --webpack` switch
// already deduplicates the server runtime and keeps the Worker under the Free
// limit without minification.
export default defineCloudflareConfig({});

