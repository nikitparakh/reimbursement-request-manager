import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  openPageAndExpectHeading,
  signIn,
  signOut,
} from "./helpers";

const db = new PrismaClient();

async function seedLifecycleRequest(title: string) {
  const [coach, requester, team] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: "coach@team.org" } }),
    db.user.findUniqueOrThrow({ where: { email: "user@team.org" } }),
    db.team.findFirstOrThrow({ where: { name: "Frog Force 503" } }),
  ]);

  const request = await db.reimbursementRequest.create({
    data: {
      title,
      description: "Seeded for Playwright lifecycle validation",
      requestedTotal: new Prisma.Decimal("47.83"),
      status: "SUBMITTED",
      submittedAt: new Date(),
      teamId: team.id,
      createdById: requester.id,
      coachId: coach.id,
    },
  });

  const receipt = await db.receiptFile.create({
    data: {
      requestId: request.id,
      fileName: "lifecycle-receipt.jpg",
      mimeType: "image/jpeg",
      storageUrl: "file:///playwright/lifecycle-receipt.jpg",
      parseStatus: "DONE",
    },
  });

  const extraction = await db.receiptExtraction.create({
    data: {
      receiptFileId: receipt.id,
      documentType: "RECEIPT",
      merchant: "Playwright Store",
      subtotal: new Prisma.Decimal("47.83"),
      tax: new Prisma.Decimal("3.44"),
      total: new Prisma.Decimal("51.27"),
      currency: "USD",
      confidence: 0.99,
    },
  });

  await db.receiptLineItem.create({
    data: {
      receiptExtractionId: extraction.id,
      position: 0,
      description: "Field snacks",
      quantity: new Prisma.Decimal("1"),
      unitPrice: new Prisma.Decimal("47.83"),
      lineTotal: new Prisma.Decimal("47.83"),
      category: "Food",
    },
  });

  await db.approvalAction.create({
    data: {
      requestId: request.id,
      actorId: requester.id,
      action: "SUBMIT",
      comment: "Submitted for review",
    },
  });

  return request;
}

test.describe("Full lifecycle E2E", () => {
  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("coach approves a submitted request and admin completes payout", async ({
    page,
  }) => {
    const title = `Lifecycle E2E ${Date.now()}`;
    await seedLifecycleRequest(title);

    await signIn(page, "coach@team.org", "Coach1234");
    await openPageAndExpectHeading(
      page,
      "/coach/team-reimbursements",
      "Team Reimbursements"
    );
    await page.getByRole("row", { name: new RegExp(title, "i") }).getByRole("button", { name: new RegExp(title, "i") }).click();
    await page.waitForURL(/\/user\/requests\/[^/]+$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: title })
    ).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /^approve$/i }).click();
    await expect(page.getByText("Coach Approved")).toBeVisible({ timeout: 10_000 });

    await signOut(page);
    await signIn(page, "admin@school.org", "Admin1234");
    await openPageAndExpectHeading(page, "/admin/inbox", "Admin Inbox");
    await page.getByRole("link", { name: title }).click();
    await expect(
      page.getByRole("heading", { name: title })
    ).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /^approve$/i }).click();
    await expect(page.getByRole("button", { name: /mark paid/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /mark paid/i }).click();
    await expect(page.getByText("PAID")).toBeVisible({ timeout: 10_000 });
  });
});
