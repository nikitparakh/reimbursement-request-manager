import path from "node:path";

// Set environment variables BEFORE any module imports
const testDbPath = path.resolve(process.cwd(), "prisma/test.db");
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long!!";
process.env.APP_URL = "http://localhost:3000";
process.env.LOCAL_STORAGE_DIR = "data/test-uploads";
