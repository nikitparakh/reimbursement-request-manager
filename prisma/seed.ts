import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [adminPassword, managerPassword, studentPassword] = await Promise.all([
    hash("Admin1234", 12),
    hash("Manager1234", 12),
    hash("Student1234", 12),
  ]);

  const [admin, manager, student] = await Promise.all([
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
      where: { email: "manager@team.org" },
      update: { role: "MANAGER", onboardingDone: true, passwordHash: managerPassword },
      create: {
        email: "manager@team.org",
        name: "Team Manager",
        role: "MANAGER",
        onboardingDone: true,
        passwordHash: managerPassword,
      },
    }),
    prisma.user.upsert({
      where: { email: "student@team.org" },
      update: { role: "STUDENT", onboardingDone: true, passwordHash: studentPassword },
      create: {
        email: "student@team.org",
        name: "Student Member",
        role: "STUDENT",
        onboardingDone: true,
        passwordHash: studentPassword,
      },
    }),
  ]);

  const team = await prisma.team.upsert({
    where: { name: "Frog Force 503" },
    update: { shortCode: "FF503", active: true },
    create: { name: "Frog Force 503", shortCode: "FF503", active: true },
  });

  await prisma.teamMembership.upsert({
    where: {
      userId_teamId_roleInTeam: {
        userId: manager.id,
        teamId: team.id,
        roleInTeam: "MANAGER",
      },
    },
    update: {},
    create: {
      userId: manager.id,
      teamId: team.id,
      roleInTeam: "MANAGER",
    },
  });

  await prisma.teamMembership.upsert({
    where: {
      userId_teamId_roleInTeam: {
        userId: student.id,
        teamId: team.id,
        roleInTeam: "STUDENT",
      },
    },
    update: {},
    create: {
      userId: student.id,
      teamId: team.id,
      roleInTeam: "STUDENT",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      eventType: "SEED_COMPLETE",
      message: "Seeded demo users, passwords, team, and memberships",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
