import { Prisma, PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

async function createSeedClient(): Promise<PrismaClient> {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    const { PrismaLibSql } = await import("@prisma/adapter-libsql");

    const adapter = new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter });
  }

  return new PrismaClient();
}

async function main() {
  const prisma = await createSeedClient();

  try {
    const [adminPassword, coachPassword, userPassword] = await Promise.all([
      hash("Admin1234", 12),
      hash("Coach1234", 12),
      hash("User1234", 12),
    ]);

    const [admin, coach, user] = await Promise.all([
      prisma.user.upsert({
        where: { email: "admin@school.org" },
        update: { role: "ADMIN", onboardingDone: true, passwordHash: adminPassword },
        create: {
          email: "admin@school.org",
          name: "School Admin",
          role: "ADMIN",
          onboardingDone: true,
          passwordHash: adminPassword,
        },
      }),
      prisma.user.upsert({
        where: { email: "coach@team.org" },
        update: { role: "COACH", onboardingDone: true, passwordHash: coachPassword },
        create: {
          email: "coach@team.org",
          name: "Team Coach",
          role: "COACH",
          onboardingDone: true,
          passwordHash: coachPassword,
        },
      }),
      prisma.user.upsert({
        where: { email: "user@team.org" },
        update: { role: "STUDENT", onboardingDone: true, passwordHash: userPassword },
        create: {
          email: "user@team.org",
          name: "Team Member",
          role: "STUDENT",
          onboardingDone: true,
          passwordHash: userPassword,
        },
      }),
    ]);

    const team = await prisma.team.upsert({
      where: { name: "Demo Team 503" },
      update: { shortCode: "DT503", glAccount: "61-296-7920-099-978-0000", active: true },
      create: { name: "Demo Team 503", shortCode: "DT503", glAccount: "61-296-7920-099-978-0000", active: true },
    });

    await prisma.teamMembership.upsert({
      where: {
        userId_teamId_roleInTeam: {
          userId: coach.id,
          teamId: team.id,
          roleInTeam: "COACH",
        },
      },
      update: {},
      create: {
        userId: coach.id,
        teamId: team.id,
        roleInTeam: "COACH",
      },
    });

    await prisma.teamMembership.upsert({
      where: {
        userId_teamId_roleInTeam: {
          userId: user.id,
          teamId: team.id,
          roleInTeam: "STUDENT",
        },
      },
      update: {},
      create: {
        userId: user.id,
        teamId: team.id,
        roleInTeam: "STUDENT",
      },
    });

    // --- Sample reimbursement requests ---

    const draftRequest = await prisma.reimbursementRequest.create({
      data: {
        title: "Robot Parts - Week 3",
        description: "Aluminum extrusions and motor controllers from AndyMark",
        teamId: team.id,
        createdById: user.id,
        coachId: coach.id,
        status: "DRAFT",
        requestedTotal: new Prisma.Decimal("0.00"),
      },
    });

    const submittedRequest = await prisma.reimbursementRequest.create({
      data: {
        title: "Field Trip Supplies",
        description: "Snacks and water for competition travel",
        teamId: team.id,
        createdById: user.id,
        coachId: coach.id,
        status: "SUBMITTED",
        requestedTotal: new Prisma.Decimal("47.83"),
        submittedAt: new Date(),
      },
    });

    const approvedRequest = await prisma.reimbursementRequest.create({
      data: {
        title: "Safety Equipment",
        description: "Safety glasses and gloves for the shop",
        teamId: team.id,
        createdById: user.id,
        coachId: coach.id,
        status: "COACH_APPROVED",
        requestedTotal: new Prisma.Decimal("89.95"),
        submittedAt: new Date(Date.now() - 3 * 86_400_000),
      },
    });

    // --- Receipts + extractions for draft request ---

    const draftReceipt = await prisma.receiptFile.create({
      data: {
        requestId: draftRequest.id,
        fileName: "andymark-order.pdf",
        mimeType: "application/pdf",
        storageUrl: "file:///seed/andymark-order.pdf",
        parseStatus: "DONE",
      },
    });

    const draftExtraction = await prisma.receiptExtraction.create({
      data: {
        receiptFileId: draftReceipt.id,
        documentType: "INVOICE",
        merchant: "AndyMark",
        total: new Prisma.Decimal("156.40"),
        tax: new Prisma.Decimal("11.40"),
        subtotal: new Prisma.Decimal("145.00"),
        currency: "USD",
        confidence: 0.92,
      },
    });

    await prisma.receiptLineItem.createMany({
      data: [
        { receiptExtractionId: draftExtraction.id, position: 0, description: "Aluminum C-Channel (4-pack)", quantity: new Prisma.Decimal("2"), unitPrice: new Prisma.Decimal("35.00"), lineTotal: new Prisma.Decimal("70.00"), category: "Materials" },
        { receiptExtractionId: draftExtraction.id, position: 1, description: "NEO Motor Controller", quantity: new Prisma.Decimal("1"), unitPrice: new Prisma.Decimal("75.00"), lineTotal: new Prisma.Decimal("75.00"), category: "Electronics" },
      ],
    });

    // --- Receipts + extractions for submitted request ---

    const submittedReceipt = await prisma.receiptFile.create({
      data: {
        requestId: submittedRequest.id,
        fileName: "walmart-receipt.jpg",
        mimeType: "image/jpeg",
        storageUrl: "file:///seed/walmart-receipt.jpg",
        parseStatus: "DONE",
      },
    });

    const submittedExtraction = await prisma.receiptExtraction.create({
      data: {
        receiptFileId: submittedReceipt.id,
        documentType: "RECEIPT",
        merchant: "Walmart",
        total: new Prisma.Decimal("51.27"),
        tax: new Prisma.Decimal("3.44"),
        subtotal: new Prisma.Decimal("47.83"),
        currency: "USD",
        confidence: 0.97,
      },
    });

    await prisma.receiptLineItem.createMany({
      data: [
        { receiptExtractionId: submittedExtraction.id, position: 0, description: "Trail Mix (12-pack)", quantity: new Prisma.Decimal("2"), unitPrice: new Prisma.Decimal("8.97"), lineTotal: new Prisma.Decimal("17.94"), category: "Food" },
        { receiptExtractionId: submittedExtraction.id, position: 1, description: "Water Bottles (24-pack)", quantity: new Prisma.Decimal("3"), unitPrice: new Prisma.Decimal("4.98"), lineTotal: new Prisma.Decimal("14.94"), category: "Beverages" },
        { receiptExtractionId: submittedExtraction.id, position: 2, description: "Granola Bars (10-pack)", quantity: new Prisma.Decimal("3"), unitPrice: new Prisma.Decimal("4.98"), lineTotal: new Prisma.Decimal("14.95"), category: "Food" },
      ],
    });

    // --- Approval for coach-approved request ---

    await prisma.approvalAction.create({
      data: {
        requestId: submittedRequest.id,
        actorId: user.id,
        action: "SUBMIT",
        comment: "Submitted for review",
      },
    });

    await prisma.approvalAction.create({
      data: {
        requestId: approvedRequest.id,
        actorId: user.id,
        action: "SUBMIT",
      },
    });

    await prisma.approvalAction.create({
      data: {
        requestId: approvedRequest.id,
        actorId: coach.id,
        action: "APPROVE",
        comment: "Looks good, safety first!",
      },
    });

    // --- Pending team registration ---

    await prisma.teamRegistrationRequest.create({
      data: {
        teamName: "Iron Panthers 4180",
        shortCode: "IP4180",
        glAccount: "61-310-8100-045-612-0000",
        notes: "New team from West High School. We have 15 members and a coach sponsor.",
        requestedById: user.id,
      },
    });

    // --- Audit log ---

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        eventType: "SEED_COMPLETE",
        message: "Seeded demo users, team, requests, receipts, and sample data",
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
