import "dotenv/config";
import { test, expect } from "@playwright/test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import {
  approvalActions,
  receiptExtractions,
  receiptFiles,
  receiptLineItems,
  reimbursementRequests,
  teams,
  users,
} from "../../src/db/schema";
import {
  openPageAndExpectHeading,
  signIn,
  signOut,
} from "./helpers";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const db = drizzle(client, { schema });

async function seedLifecycleRequest(title: string) {
  const [coach, requester, team] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.email, "coach@team.org") }),
    db.query.users.findFirst({ where: eq(users.email, "user@team.org") }),
    db.query.teams.findFirst({ where: eq(teams.name, "Frog Force 503") }),
  ]);
  if (!coach || !requester || !team) {
    throw new Error("Seed prerequisites missing (run npm run db:seed first)");
  }

  const [request] = await db
    .insert(reimbursementRequests)
    .values({
      title,
      description: "Seeded for Playwright lifecycle validation",
      requestedTotal: 47.83,
      status: "SUBMITTED",
      submittedAt: new Date(),
      teamId: team.id,
      createdById: requester.id,
      coachId: coach.id,
    })
    .returning();

  const [receipt] = await db
    .insert(receiptFiles)
    .values({
      requestId: request.id,
      fileName: "lifecycle-receipt.jpg",
      mimeType: "image/jpeg",
      storageUrl: "file:///playwright/lifecycle-receipt.jpg",
      parseStatus: "DONE",
    })
    .returning();

  const [extraction] = await db
    .insert(receiptExtractions)
    .values({
      receiptFileId: receipt.id,
      documentType: "RECEIPT",
      merchant: "Playwright Store",
      subtotal: 47.83,
      tax: 3.44,
      total: 51.27,
      currency: "USD",
      confidence: 0.99,
    })
    .returning();

  await db.insert(receiptLineItems).values({
    receiptExtractionId: extraction.id,
    position: 0,
    description: "Field snacks",
    quantity: 1,
    unitPrice: 47.83,
    lineTotal: 47.83,
    category: "Food",
  });

  await db.insert(approvalActions).values({
    requestId: request.id,
    actorId: requester.id,
    action: "SUBMIT",
    comment: "Submitted for review",
  });

  return request;
}

test.describe("Full lifecycle E2E", () => {
  test.afterAll(async () => {
    client.close();
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
