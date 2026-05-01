import { test, expect } from "@playwright/test";
import { openPageAndExpectHeading, signIn } from "./helpers";

test.describe("Admin flow", () => {
  test("super admin can load admin pages and create a team", async ({
    page,
  }) => {
    const teamName = `E2E Admin Team ${Date.now()}`;

    await signIn(page, "admin@school.org", "Admin1234");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await openPageAndExpectHeading(page, "/admin/teams", "Manage Teams");
    await page.getByRole("button", { name: /create team/i }).click();
    await page.getByLabel("School").selectOption({ index: 0 });
    await page.getByLabel("Program").selectOption({ index: 0 });
    await page.getByLabel("Team Name").fill(teamName);
    await page.getByRole("button", { name: /^create$/i }).click();
    await expect(page.getByRole("link", { name: teamName })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("link", { name: teamName }).click();
    await expect(page.getByRole("heading", { name: teamName })).toBeVisible({
      timeout: 10_000,
    });

    await openPageAndExpectHeading(page, "/admin/users", "Manage Users");
    await openPageAndExpectHeading(page, "/admin/inbox", "Admin Inbox");
    await openPageAndExpectHeading(page, "/admin/requests", "All Reimbursements");
    await openPageAndExpectHeading(
      page,
      "/admin/team-requests",
      "Team Registrations"
    );
    await openPageAndExpectHeading(page, "/profile", "Profile");
  });
});
