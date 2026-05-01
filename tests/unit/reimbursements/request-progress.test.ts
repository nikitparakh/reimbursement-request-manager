import { describe, expect, it } from "vitest";

import {
  buildRequestStages,
  type RequestProgressApproval,
} from "@/components/reimbursements/request-progress";

const SUBMIT_AT = new Date("2026-04-01T10:00:00Z");
const COACH_DECISION_AT = new Date("2026-04-01T11:00:00Z");
const ADMIN_DECISION_AT = new Date("2026-04-02T09:00:00Z");
const PAID_AT = new Date("2026-04-03T14:00:00Z");

function approvals(
  partial: Array<Pick<RequestProgressApproval, "action" | "createdAt"> & { comment?: string | null }>
): RequestProgressApproval[] {
  return partial.map((a, idx) => ({
    id: `a${idx}`,
    action: a.action,
    comment: a.comment ?? null,
    createdAt: a.createdAt,
  }));
}

describe("buildRequestStages", () => {
  it("renders all 4 stages in order", () => {
    const stages = buildRequestStages({ status: "DRAFT", approvals: [] });
    expect(stages.map((s) => s.id)).toEqual(["submit", "coach", "admin", "payment"]);
  });

  it("DRAFT shows submission as current and the rest upcoming", () => {
    const stages = buildRequestStages({ status: "DRAFT", approvals: [] });
    expect(stages[0]!.state.kind).toBe("current");
    expect(stages[1]!.state.kind).toBe("upcoming");
    expect(stages[2]!.state.kind).toBe("upcoming");
    expect(stages[3]!.state.kind).toBe("upcoming");
  });

  it("SUBMITTED marks submission complete and coach current", () => {
    const stages = buildRequestStages({
      status: "SUBMITTED",
      approvals: approvals([{ action: "SUBMIT", createdAt: SUBMIT_AT }]),
    });
    expect(stages[0]!.state).toMatchObject({ kind: "complete", at: SUBMIT_AT });
    expect(stages[1]!.state.kind).toBe("current");
    expect(stages[2]!.state.kind).toBe("upcoming");
    expect(stages[3]!.state.kind).toBe("upcoming");
  });

  it("COACH_APPROVED carries the coach comment and date and makes admin current", () => {
    const stages = buildRequestStages({
      status: "COACH_APPROVED",
      approvals: approvals([
        { action: "SUBMIT", createdAt: SUBMIT_AT },
        { action: "APPROVE", createdAt: COACH_DECISION_AT, comment: "Looks good" },
      ]),
    });
    expect(stages[1]!.state).toMatchObject({
      kind: "complete",
      at: COACH_DECISION_AT,
      comment: "Looks good",
    });
    expect(stages[2]!.state.kind).toBe("current");
    expect(stages[3]!.state.kind).toBe("upcoming");
  });

  it("COACH_REJECTED marks downstream stages skipped and surfaces the rejection comment", () => {
    const stages = buildRequestStages({
      status: "COACH_REJECTED",
      approvals: approvals([
        { action: "SUBMIT", createdAt: SUBMIT_AT },
        { action: "REJECT", createdAt: COACH_DECISION_AT, comment: "Missing receipt" },
      ]),
    });
    expect(stages[1]!.state).toMatchObject({
      kind: "rejected",
      at: COACH_DECISION_AT,
      comment: "Missing receipt",
    });
    expect(stages[2]!.state.kind).toBe("skipped");
    expect(stages[3]!.state.kind).toBe("skipped");
  });

  it("ADMIN_APPROVED marks payment current and both reviews complete", () => {
    const stages = buildRequestStages({
      status: "ADMIN_APPROVED",
      approvals: approvals([
        { action: "SUBMIT", createdAt: SUBMIT_AT },
        { action: "APPROVE", createdAt: COACH_DECISION_AT },
        { action: "APPROVE", createdAt: ADMIN_DECISION_AT, comment: "OK to pay" },
      ]),
    });
    expect(stages[1]!.state).toMatchObject({ kind: "complete", at: COACH_DECISION_AT });
    expect(stages[2]!.state).toMatchObject({
      kind: "complete",
      at: ADMIN_DECISION_AT,
      comment: "OK to pay",
    });
    expect(stages[3]!.state.kind).toBe("current");
  });

  it("ADMIN_REJECTED keeps coach complete, marks admin rejected, and skips payment", () => {
    const stages = buildRequestStages({
      status: "ADMIN_REJECTED",
      approvals: approvals([
        { action: "SUBMIT", createdAt: SUBMIT_AT },
        { action: "APPROVE", createdAt: COACH_DECISION_AT },
        { action: "REJECT", createdAt: ADMIN_DECISION_AT, comment: "Out of policy" },
      ]),
    });
    expect(stages[1]!.state.kind).toBe("complete");
    expect(stages[2]!.state).toMatchObject({
      kind: "rejected",
      at: ADMIN_DECISION_AT,
      comment: "Out of policy",
    });
    expect(stages[3]!.state.kind).toBe("skipped");
  });

  it("PAID completes every stage and uses the MARK_PAID timestamp for payment", () => {
    const stages = buildRequestStages({
      status: "PAID",
      approvals: approvals([
        { action: "SUBMIT", createdAt: SUBMIT_AT },
        { action: "APPROVE", createdAt: COACH_DECISION_AT },
        { action: "APPROVE", createdAt: ADMIN_DECISION_AT },
        { action: "MARK_PAID", createdAt: PAID_AT, comment: "EFT batch 21" },
      ]),
    });
    expect(stages.every((s) => s.state.kind === "complete")).toBe(true);
    expect(stages[3]!.state).toMatchObject({
      kind: "complete",
      at: PAID_AT,
      comment: "EFT batch 21",
    });
  });

  it("treats approvals from a previous cycle (REOPEN flow) as stale", () => {
    const olderSubmit = new Date("2026-03-10T10:00:00Z");
    const olderReject = new Date("2026-03-10T11:00:00Z");
    const newerSubmit = new Date("2026-04-01T10:00:00Z");
    const stages = buildRequestStages({
      status: "SUBMITTED",
      approvals: approvals([
        { action: "SUBMIT", createdAt: olderSubmit },
        { action: "REJECT", createdAt: olderReject, comment: "stale" },
        { action: "REOPEN", createdAt: new Date("2026-03-15T10:00:00Z") },
        { action: "SUBMIT", createdAt: newerSubmit },
      ]),
    });
    expect(stages[0]!.state).toMatchObject({ kind: "complete", at: newerSubmit });
    expect(stages[1]!.state.kind).toBe("current");
  });

  it("never references actor identity in any stage detail", () => {
    const stages = buildRequestStages({
      status: "ADMIN_APPROVED",
      approvals: approvals([
        { action: "SUBMIT", createdAt: SUBMIT_AT },
        { action: "APPROVE", createdAt: COACH_DECISION_AT, comment: "ok" },
        { action: "APPROVE", createdAt: ADMIN_DECISION_AT },
      ]),
    });
    for (const stage of stages) {
      const allCopy = [
        ...Object.values(stage.detail),
        ...Object.values(stage.pillLabel),
        stage.label,
      ].join(" ");
      expect(allCopy).not.toMatch(/@/);
      expect(allCopy.toLowerCase()).not.toMatch(/email/);
    }
  });
});
