import { vi } from "vitest";
import type { GlobalRole } from "@/db/schema";

type MockUser = {
  id: string;
  email: string;
  name?: string | null;
  role: GlobalRole;
};

let currentUser: MockUser | null = null;

// Mock @/auth before any route handler imports
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => {
    if (!currentUser) return null;
    return {
      user: {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name ?? null,
        role: currentUser.role,
      },
    };
  }),
}));

// Mock next/cache — not available outside Next.js runtime
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

export function setMockUser(user: MockUser) {
  currentUser = user;
}

export function clearMockSession() {
  currentUser = null;
}
