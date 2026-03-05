import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("User flow", () => {
  test("sign in and create a new request", async ({ page }) => {
    // Sign in as the seeded user
    await signIn(page, "user@team.org", "User1234");

    // Should land on dashboard
    await expect(page.getByText("Dashboard")).toBeVisible();

    // Navigate to new request page
    await page.getByText("New Request").click();
    await expect(page.getByText("New Reimbursement Request")).toBeVisible();

    // Fill request form
    await page.getByLabel("Title").fill("E2E Test Request");
    await page.getByLabel("Description").fill("Testing via Playwright");

    // Team should already be selected (seeded team)
    const createButton = page.getByRole("button", { name: /create draft/i });
    await createButton.click();

    // Button should show loading state
    await expect(createButton).toBeDisabled();

    // Should show success message
    await expect(page.getByText("Draft created successfully")).toBeVisible({
      timeout: 10_000,
    });

    // Should have a link to open the request
    const openLink = page.getByText("Open request to upload receipts");
    await expect(openLink).toBeVisible();
  });
});
