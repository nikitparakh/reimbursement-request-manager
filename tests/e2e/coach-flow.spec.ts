import { test, expect } from "@playwright/test";
import { openPageAndExpectHeading, signIn } from "./helpers";

test.describe("Coach flow", () => {
  test("coach can load team pages and open a request", async ({ page }) => {
    await signIn(page, "coach@team.org", "Coach1234");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await openPageAndExpectHeading(page, "/coach/team-overview", "Team Overview");
    await expect(page.getByText("Frog Force 503")).toBeVisible();

    await openPageAndExpectHeading(
      page,
      "/coach/team-reimbursements",
      "Team Reimbursements"
    );
    const fieldTripRow = page.getByRole("row", { name: /Field Trip Supplies/i });
    await expect(fieldTripRow).toBeVisible();
    await fieldTripRow.getByRole("button", { name: /Field Trip Supplies/i }).click();
    await page.waitForURL(/\/user\/requests\/[^/]+$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Field Trip Supplies" })
    ).toBeVisible({
      timeout: 10_000,
    });

    await openPageAndExpectHeading(page, "/team", "My Team");
    await openPageAndExpectHeading(page, "/profile", "Profile");
  });
});
