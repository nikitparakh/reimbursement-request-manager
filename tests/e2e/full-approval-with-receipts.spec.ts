import { test, expect } from "@playwright/test";
import { openPageAndExpectHeading, signIn } from "./helpers";

test.describe("Scoped admin E2E", () => {
  test("school admin can load school-admin pages", async ({ page }) => {
    await signIn(page, "schooladmin@school.org", "SchoolAdmin1234");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Team Registrations", exact: true })
    ).toBeVisible();
    await openPageAndExpectHeading(page, "/admin/teams", "Manage Teams");
    await expect(page.getByText("Frog Force 503")).toBeVisible();
    await openPageAndExpectHeading(page, "/admin/users", "Manage Users");
    await openPageAndExpectHeading(page, "/admin/inbox", "Admin Inbox");
    await openPageAndExpectHeading(page, "/admin/requests", "All Reimbursements");
    await openPageAndExpectHeading(page, "/admin/team-requests", "Team Registrations");
    await openPageAndExpectHeading(page, "/profile", "Profile");
  });

  test("program admin sees program-scoped admin pages without user management", async ({
    page,
  }) => {
    await signIn(page, "programadmin@school.org", "ProgramAdmin1234");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Team Registrations", exact: true })
    ).toBeVisible();
    await openPageAndExpectHeading(page, "/admin/teams", "Manage Teams");
    await expect(page.getByText("Frog Tech")).toBeVisible();
    await expect(page.getByText("Frog Force 503")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Manage Users", exact: true })
    ).toHaveCount(0);
    await openPageAndExpectHeading(page, "/admin/inbox", "Admin Inbox");
    await openPageAndExpectHeading(page, "/admin/requests", "All Reimbursements");
    await openPageAndExpectHeading(page, "/admin/team-requests", "Team Registrations");
    await openPageAndExpectHeading(page, "/profile", "Profile");
  });
});
