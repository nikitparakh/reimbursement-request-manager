import { test, expect } from "@playwright/test";
import { createDraft, signIn } from "./helpers";
import path from "node:path";
import { writeFile, mkdir, rm } from "node:fs/promises";

const FIXTURE_DIR = path.resolve("tests/e2e/fixtures");
const FIXTURE_FILE = path.join(FIXTURE_DIR, "test-receipt.pdf");

test.beforeAll(async () => {
  await mkdir(FIXTURE_DIR, { recursive: true });
  await writeFile(FIXTURE_FILE, "%PDF-1.4 fake receipt content");
});

test.afterAll(async () => {
  await rm(FIXTURE_DIR, { recursive: true, force: true }).catch(() => {});
});

test.describe("Receipt upload E2E", () => {
  test("user creates draft and uploads a receipt", async ({ page }) => {
    const title = `Receipt Upload E2E ${Date.now()}`;

    await signIn(page, "user@team.org", "User1234");
    await createDraft(page, title, "Testing receipt upload");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_FILE);
    await page.waitForTimeout(3000);

    await expect(page.getByText("test-receipt.pdf")).toBeVisible({
      timeout: 10_000,
    });
  });
});
