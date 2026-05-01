import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";

const schema = z.object({
  districtId: z.string().min(1),
  schoolId: z.string().min(1),
  programId: z.string().min(1),
  teamId: z.string().min(1),
  roleIntent: z.enum(["PARENT_MENTOR", "COACH"]),
});

export async function POST(request: Request) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const [dbUser, team] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, onboardingDone: true },
    }),
    db.team.findUnique({
      where: { id: body.data.teamId },
      select: {
        id: true,
        active: true,
        schoolId: true,
        programId: true,
        school: { select: { districtId: true } },
      },
    }),
  ]);

  if (!dbUser) {
    return NextResponse.json(
      {
        error:
          "Your session is out of date. Please sign out and sign in again before completing onboarding.",
      },
      { status: 401 }
    );
  }
  if (dbUser.onboardingDone) {
    return NextResponse.json(
      { error: "Onboarding has already been completed for this account." },
      { status: 409 }
    );
  }

  if (
    !team ||
    !team.active ||
    team.school.districtId !== body.data.districtId ||
    team.schoolId !== body.data.schoolId ||
    team.programId !== body.data.programId
  ) {
    return NextResponse.json({ error: "Selected team is unavailable." }, { status: 400 });
  }

  const membershipRole = body.data.roleIntent === "COACH" ? "COACH" : "PARENT_MENTOR";

  try {
    const membership = await db.$transaction(async (tx) => {
      const membership = await tx.teamMembership.upsert({
        where: {
          userId_teamId_roleInTeam: {
            userId,
            teamId: body.data.teamId,
            roleInTeam: membershipRole,
          },
        },
        update: { approved: true },
        create: {
          userId,
          teamId: body.data.teamId,
          roleInTeam: membershipRole,
          approved: true,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          onboardingDone: true,
        },
      });

      return membership;
    });

    return NextResponse.json({ membership });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "Unable to link user to the selected team. Please refresh and try again." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Unable to complete onboarding." }, { status: 500 });
  }
}
