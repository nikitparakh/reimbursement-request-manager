import { z } from "zod";

// Only plaintext config that the app reads via process.env. Database and
// storage come from Cloudflare bindings (getCloudflareContext().env), not here.
// All fields are optional/defaulted so importing this never throws at module
// load on the Workers runtime.
const envSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GOOGLE_AI_MODEL: z.string().default("gemini-2.5-flash"),
  LOCAL_STORAGE_DIR: z.string().default("data/uploads"),
});

export const env = envSchema.parse(process.env);
