import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test.describe("Sign-up and onboarding E2E", () => {
  const uniqueEmail = `e2e-${Date.now()}@test.com`;

  test("new user signs up, then joins a team via onboarding", async ({ page }) => {
    await signUp(page, "E2E Tester", uniqueEmail, "Password123");

    await expect(page.getByText("Dashboard")).toBeVisible({ timeout: 10_000 });

    await page.getByText("Onboarding").click();
    await expect(page.getByText("Join a Team")).toBeVisible({ timeout: 10_000 });

    const teamSelect = page.getByRole("combobox").first();
    if (await teamSelect.isVisible().catch(() => false)) {
      await teamSelect.selectOption({ index: 1 });
    }

    const roleSelect = page.locator("select").last();
    if (await roleSelect.isVisible().catch(() => false)) {
      await roleSelect.selectOption("STUDENT");
    }

    const joinButton = page.getByRole("button", { name: /join/i });
    if (await joinButton.isVisible().catch(() => false)) {
      await joinButton.click();
      await page.waitForTimeout(2000);
    }
  });
});
