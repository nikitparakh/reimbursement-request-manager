import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Coach flow", () => {
  test("sign in and view coach inbox", async ({ page }) => {
    await signIn(page, "coach@team.org", "Coach1234");

    // Should land on dashboard
    await expect(page.getByText("Dashboard")).toBeVisible();

    // Navigate to coach inbox
    await page.getByText("Review Inbox").click();
    await expect(page.getByText("Coach Inbox")).toBeVisible();

    // Should show either pending requests or empty state
    const hasPending = await page.getByText("pending").first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText("No pending requests").isVisible().catch(() => false);
    expect(hasPending || hasEmpty).toBe(true);
  });
});
