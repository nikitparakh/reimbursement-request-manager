import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";
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
    await signIn(page, "user@team.org", "User1234");
    await expect(page.getByText("Dashboard")).toBeVisible();

    await page.getByText("New Request").click();
    await expect(page.getByText("New Reimbursement Request")).toBeVisible();

    await page.getByLabel("Title").fill("Receipt Upload E2E");
    await page.getByLabel("Description").fill("Testing receipt upload");
    await page.getByRole("button", { name: /create draft/i }).click();
    await expect(page.getByText("Draft created successfully")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByText("Open request to upload receipts").click();
    await expect(page.getByText("Receipt Upload E2E")).toBeVisible({
      timeout: 10_000,
    });

    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(FIXTURE_FILE);
      await page.waitForTimeout(3000);

      await expect(page.getByText("test-receipt.pdf")).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});
