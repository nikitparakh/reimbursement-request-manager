import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type AdminReviewTarget = {
  districtId: string;
  schoolId: string;
  programId: string;
};

export function buildAdminReviewRecipientWhere(
  target: AdminReviewTarget
): Prisma.UserWhereInput {
  return {
    OR: [
      { role: "SUPER_ADMIN" },
      {
        scopedRoles: {
          some: {
            role: "SCHOOL_ADMIN",
            OR: [
              { schoolId: target.schoolId },
              {
                districtId: target.districtId,
                schoolId: null,
              },
            ],
          },
        },
      },
      {
        scopedRoles: {
          some: {
            role: "PROGRAM_ADMIN",
            schoolId: target.schoolId,
            programId: target.programId,
          },
        },
      },
    ],
  };
}

export async function getAdminReviewRecipientEmails(target: AdminReviewTarget) {
  const admins = await db.user.findMany({
    where: buildAdminReviewRecipientWhere(target),
    select: { email: true },
  });

  return Array.from(
    new Set(admins.map((admin) => admin.email).filter((email): email is string => Boolean(email)))
  );
}
