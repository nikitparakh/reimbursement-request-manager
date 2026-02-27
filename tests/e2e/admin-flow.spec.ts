import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Admin flow", () => {
  test("sign in and view admin dashboard", async ({ page }) => {
    await signIn(page, "admin@school.org", "Admin1234");

    // Should land on dashboard
    await expect(page.getByText("Dashboard")).toBeVisible();

    // Admin should see Admin Inbox link
    await expect(page.getByText("Admin Inbox")).toBeVisible();

    // Admin should see Team Registrations link
    await expect(page.getByText("Team Registrations")).toBeVisible();
  });
});
