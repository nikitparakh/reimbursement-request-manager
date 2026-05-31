import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  // For `drizzle-kit push`/introspect against remote D1, switch driver to
  // "d1-http" and supply CLOUDFLARE_ACCOUNT_ID / D1 database id / token.
  // `drizzle-kit generate` only needs the sqlite dialect.
});
