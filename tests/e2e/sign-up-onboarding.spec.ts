import { test, expect } from "@playwright/test";
import { openPageAndExpectHeading, signUp } from "./helpers";

test.describe("Sign-up and onboarding E2E", () => {
  const uniqueEmail = `e2e-${Date.now()}@test.com`;

  test("policy remains public and admin sign-up redirects to the standard sign-up page", async ({
    page,
  }) => {
    await openPageAndExpectHeading(page, "/policy", "Reimbursement Policy");
    await page.goto("/admin-sign-up");
    await page.waitForURL(/\/sign-up$/, { timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /create account/i })
    ).toBeVisible();
  });

  test("new user signs up, then joins a team via onboarding", async ({ page }) => {
    await signUp(page, "E2E Tester", uniqueEmail, "Password123");

    await openPageAndExpectHeading(page, "/onboarding", "Get Started");
    await expect(page.getByText("Join an Existing Team")).toBeVisible({
      timeout: 10_000,
    });
    await page.locator("#roleIntent").selectOption("PARENT_MENTOR");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(
      page.getByText("Onboarding complete. Your team workspace is ready.")
    ).toBeVisible({
      timeout: 10_000,
    });

    await openPageAndExpectHeading(page, "/team", "My Team");
  });
});
