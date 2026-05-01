import { test, expect } from "@playwright/test";
import { createDraft, openPageAndExpectHeading, signIn } from "./helpers";

test.describe("User flow", () => {
  test("notification polling waits until the bell is opened", async ({ page }) => {
    const notificationRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/notifications")) {
        notificationRequests.push(request.url());
      }
    });

    await signIn(page, "user@team.org", "User1234");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.waitForTimeout(1_000);

    expect(notificationRequests).toHaveLength(0);

    await page.getByRole("button", { name: /notifications/i }).click();
    await expect
      .poll(() => notificationRequests.length, {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
  });

  test("parent mentor can load member pages and create a draft", async ({
    page,
  }) => {
    const title = `E2E User Draft ${Date.now()}`;

    await signIn(page, "user@team.org", "User1234");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await openPageAndExpectHeading(page, "/team", "My Team");
    await expect(page.getByText("Frog Force 503")).toBeVisible();
    await openPageAndExpectHeading(page, "/user/requests", "My Requests");
    await openPageAndExpectHeading(page, "/profile", "Profile");

    await createDraft(page, title, "Testing via Playwright");
    await expect(page.getByRole("button", { name: /delete draft/i })).toBeVisible();
  });
});
