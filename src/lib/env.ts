import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_URL: z.string().url().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GOOGLE_AI_MODEL: z.string().default("gemini-2.5-flash"),
  LOCAL_STORAGE_DIR: z.string().default("data/uploads"),
  INTERNAL_JOB_SECRET: z.string().min(1).default("dev-job-secret"),
});

export const env = envSchema.parse(process.env);
