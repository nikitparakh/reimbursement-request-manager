import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});

// Minify the server bundle to keep the Worker under the Free-plan 3 MiB limit.
config.default = { ...config.default, minify: true };

export default config;
