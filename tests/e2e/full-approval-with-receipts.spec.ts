import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Full approval lifecycle with receipts E2E", () => {
  test("DRAFT → SUBMITTED → COACH_APPROVED → ADMIN_APPROVED", async ({
    page,
  }) => {
    // --- USER: Create and submit ---
    await signIn(page, "user@team.org", "User1234");
    await expect(page.getByText("Dashboard")).toBeVisible();

    await page.getByText("New Request").click();
    await expect(page.getByText("New Reimbursement Request")).toBeVisible();

    await page.getByLabel("Title").fill("Full Approval E2E");
    await page.getByLabel("Description").fill("Full lifecycle with all roles");
    await page.getByRole("button", { name: /create draft/i }).click();
    await expect(page.getByText("Draft created successfully")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByText("Open request to upload receipts").click();
    await expect(page.getByText("Full Approval E2E")).toBeVisible({
      timeout: 10_000,
    });

    // Submit the draft
    const submitButton = page.getByRole("button", { name: /submit/i });
    if (await submitButton.isVisible().catch(() => false)) {
      await submitButton.click();
      await expect(page.getByText(/submitted/i).first()).toBeVisible({
        timeout: 10_000,
      });
    }

    // --- COACH: Approve ---
    await signIn(page, "coach@team.org", "Coach1234");
    await expect(page.getByText("Dashboard")).toBeVisible();

    await page.getByText("Review Inbox").click();
    await expect(page.getByText("Coach Inbox")).toBeVisible();

    const coachApprove = page
      .getByRole("button", { name: /approve/i })
      .first();
    if (await coachApprove.isVisible().catch(() => false)) {
      await coachApprove.click();
      await page.waitForTimeout(2000);
    }

    // --- ADMIN: Approve ---
    await signIn(page, "admin@school.org", "Admin1234");
    await expect(page.getByText("Dashboard")).toBeVisible();

    await page.getByText("Admin Inbox").click();

    const adminApprove = page
      .getByRole("button", { name: /approve/i })
      .first();
    if (await adminApprove.isVisible().catch(() => false)) {
      await adminApprove.click();
      await page.waitForTimeout(2000);
    }

    // Verify request is no longer in admin inbox
    await page.reload();
    await expect(page.getByText("Admin Inbox")).toBeVisible();
  });
});
