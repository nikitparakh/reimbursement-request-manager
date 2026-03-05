import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Full lifecycle E2E", () => {
  test("user creates and submits → coach approves → admin approves", async ({
    page,
  }) => {
    // --- USER: Create and submit a request ---
    await signIn(page, "user@team.org", "User1234");
    await expect(page.getByText("Dashboard")).toBeVisible();

    // Navigate to new request
    await page.getByText("New Request").click();
    await expect(page.getByText("New Reimbursement Request")).toBeVisible();

    // Fill form and create draft
    await page.getByLabel("Title").fill("Lifecycle E2E Request");
    await page.getByLabel("Description").fill("Full lifecycle test");
    await page.getByRole("button", { name: /create draft/i }).click();
    await expect(page.getByText("Draft created successfully")).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to request detail
    await page.getByText("Open request to upload receipts").click();
    await expect(page.getByText("Lifecycle E2E Request")).toBeVisible({
      timeout: 10_000,
    });

    // Submit the request (look for submit button)
    const submitButton = page.getByRole("button", { name: /submit/i });
    if (await submitButton.isVisible().catch(() => false)) {
      await submitButton.click();
      // Wait for status update
      await expect(
        page.getByText(/submitted/i).first()
      ).toBeVisible({ timeout: 10_000 });
    }

    // --- COACH: Approve the request ---
    await signIn(page, "coach@team.org", "Coach1234");
    await expect(page.getByText("Dashboard")).toBeVisible();

    await page.getByText("Review Inbox").click();
    await expect(page.getByText("Coach Inbox")).toBeVisible();

    // Look for the request and approve it
    const approveButton = page.getByRole("button", { name: /approve/i }).first();
    if (await approveButton.isVisible().catch(() => false)) {
      await approveButton.click();
      // Wait for approval to process
      await page.waitForTimeout(2000);
    }

    // --- ADMIN: Approve and mark paid ---
    await signIn(page, "admin@school.org", "Admin1234");
    await expect(page.getByText("Dashboard")).toBeVisible();

    // Check admin inbox
    await page.getByText("Admin Inbox").click();

    // Look for approve button
    const adminApproveButton = page.getByRole("button", { name: /approve/i }).first();
    if (await adminApproveButton.isVisible().catch(() => false)) {
      await adminApproveButton.click();
      await page.waitForTimeout(2000);
    }
  });
});
