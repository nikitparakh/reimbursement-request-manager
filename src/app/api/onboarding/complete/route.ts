import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";

const schema = z.object({
  teamId: z.string().min(1),
  roleIntent: z.enum(["STUDENT", "COACH"]),
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
    db.user.findUnique({ where: { id: userId }, select: { id: true } }),
    db.team.findUnique({
      where: { id: body.data.teamId },
      select: { id: true, active: true },
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

  if (!team || !team.active) {
    return NextResponse.json({ error: "Selected team is unavailable." }, { status: 400 });
  }

  try {
    const membership = await db.teamMembership.upsert({
      where: {
        userId_teamId_roleInTeam: {
          userId,
          teamId: body.data.teamId,
          roleInTeam: body.data.roleIntent,
        },
      },
      update: { approved: true },
      create: {
        userId,
        teamId: body.data.teamId,
        roleInTeam: body.data.roleIntent,
        approved: true,
      },
    });

    await db.user.update({
      where: { id: userId },
      data: {
        role: body.data.roleIntent,
        onboardingDone: true,
      },
    });

    return NextResponse.json({ membership });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "Unable to link user to team. Please refresh and try again." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Unable to complete onboarding." }, { status: 500 });
  }
}
