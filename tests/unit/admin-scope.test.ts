import { beforeEach, describe, expect, it } from "vitest";
import "../helpers/auth-mock";
import { getDb } from "@/lib/db";
import { buildAccessContext } from "@/lib/access";
import {
  buildManagedReimbursementWhere,
  buildManagedTeamRegistrationWhere,
  buildManagedTeamWhere,
} from "@/lib/admin-scope";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createDistrict,
  createProgram,
  createRequest,
  createSchool,
  createTeam,
  createTeamRegistrationRequest,
  createUser,
} from "../helpers/factory";

function context(
  globalRole: "USER" | "SUPER_ADMIN",
  scopedRoles: {
    role: "SCHOOL_ADMIN" | "PROGRAM_ADMIN";
    districtId?: string | null;
    schoolId?: string | null;
    programId?: string | null;
    teamId?: string | null;
  }[]
) {
  return buildAccessContext({
    userId: "user-1",
    globalRole,
    scopedRoles: scopedRoles.map((r) => ({
      role: r.role,
      districtId: r.districtId ?? null,
      schoolId: r.schoolId ?? null,
      programId: r.programId ?? null,
      teamId: r.teamId ?? null,
    })),
  });
}

describe("admin scope helpers", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("gives super admins unscoped filters (undefined = no restriction)", () => {
    const ctx = context("SUPER_ADMIN", []);
    expect(buildManagedTeamWhere(ctx)).toBeUndefined();
    expect(buildManagedTeamRegistrationWhere(ctx)).toBeUndefined();
    expect(buildManagedReimbursementWhere(ctx)).toBeUndefined();
  });

  it("school-admin filter matches only teams in the assigned school", async () => {
    const db = getDb();
    const district = await createDistrict();
    const inSchool = await createSchool({ districtId: district.id });
    const outSchool = await createSchool({ districtId: district.id });
    const program = await createProgram({ code: "FLL" });
    const inTeam = await createTeam({ schoolId: inSchool.id, programId: program.id });
    await createTeam({ schoolId: outSchool.id, programId: program.id });

    const ctx = context("USER", [
      { role: "SCHOOL_ADMIN", districtId: district.id, schoolId: inSchool.id },
    ]);

    const where = buildManagedTeamWhere(ctx);
    const matched = await db.query.teams.findMany({ where });
    expect(matched.map((t) => t.id)).toEqual([inTeam.id]);
  });

  it("program-admin filter matches only the assigned school+program teams", async () => {
    const db = getDb();
    const district = await createDistrict();
    const school = await createSchool({ districtId: district.id });
    const fll = await createProgram({ code: "FLL" });
    const ftc = await createProgram({ code: "FTC" });
    const inTeam = await createTeam({ schoolId: school.id, programId: fll.id });
    await createTeam({ schoolId: school.id, programId: ftc.id });

    const ctx = context("USER", [
      {
        role: "PROGRAM_ADMIN",
        districtId: district.id,
        schoolId: school.id,
        programId: fll.id,
      },
    ]);

    const matched = await db.query.teams.findMany({
      where: buildManagedTeamWhere(ctx),
    });
    expect(matched.map((t) => t.id)).toEqual([inTeam.id]);
  });

  it("reimbursement filter matches only requests for in-scope teams", async () => {
    const db = getDb();
    const district = await createDistrict();
    const inSchool = await createSchool({ districtId: district.id });
    const outSchool = await createSchool({ districtId: district.id });
    const program = await createProgram({ code: "FLL" });
    const inTeam = await createTeam({ schoolId: inSchool.id, programId: program.id });
    const outTeam = await createTeam({ schoolId: outSchool.id, programId: program.id });
    const user = await createUser();
    const inReq = await createRequest({ teamId: inTeam.id, createdById: user.id });
    await createRequest({ teamId: outTeam.id, createdById: user.id });

    const ctx = context("USER", [
      { role: "SCHOOL_ADMIN", districtId: district.id, schoolId: inSchool.id },
    ]);

    const matched = await db.query.reimbursementRequests.findMany({
      where: buildManagedReimbursementWhere(ctx),
    });
    expect(matched.map((r) => r.id)).toEqual([inReq.id]);
  });

  it("registration filter matches only in-scope registration requests", async () => {
    const db = getDb();
    const district = await createDistrict();
    const inSchool = await createSchool({ districtId: district.id });
    const outSchool = await createSchool({ districtId: district.id });
    const program = await createProgram({ code: "FLL" });
    const requester = await createUser();
    const inReg = await createTeamRegistrationRequest({
      districtId: district.id,
      schoolId: inSchool.id,
      programId: program.id,
      teamName: "In Scope",
      requestedById: requester.id,
    });
    await createTeamRegistrationRequest({
      districtId: district.id,
      schoolId: outSchool.id,
      programId: program.id,
      teamName: "Out of Scope",
      requestedById: requester.id,
    });

    const ctx = context("USER", [
      { role: "SCHOOL_ADMIN", districtId: district.id, schoolId: inSchool.id },
    ]);

    const matched = await db.query.teamRegistrationRequests.findMany({
      where: buildManagedTeamRegistrationWhere(ctx),
    });
    expect(matched.map((r) => r.id)).toEqual([inReg.id]);
  });
});
