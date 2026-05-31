import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { teamMemberships, teams, users } from "@/db/schema";

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
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, onboardingDone: true },
    }),
    db.query.teams.findFirst({
      where: eq(teams.id, body.data.teamId),
      columns: {
        id: true,
        active: true,
        schoolId: true,
        programId: true,
      },
      with: {
        school: { columns: { districtId: true } },
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
    // D1 has no interactive transactions: apply both writes atomically with
    // db.batch(). The membership upsert returns the row.
    const [membershipRows] = await db.batch([
      db
        .insert(teamMemberships)
        .values({
          userId,
          teamId: body.data.teamId,
          roleInTeam: membershipRole,
          approved: true,
        })
        .onConflictDoUpdate({
          target: [
            teamMemberships.userId,
            teamMemberships.teamId,
            teamMemberships.roleInTeam,
          ],
          set: { approved: true },
        })
        .returning(),
      db
        .update(users)
        .set({ onboardingDone: true })
        .where(eq(users.id, userId)),
    ]);

    const membership = membershipRows[0];

    return NextResponse.json({ membership });
  } catch (error) {
    if (
      error instanceof Error &&
      /FOREIGN KEY constraint failed/i.test(error.message)
    ) {
      return NextResponse.json(
        { error: "Unable to link user to the selected team. Please refresh and try again." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Unable to complete onboarding." }, { status: 500 });
  }
}
