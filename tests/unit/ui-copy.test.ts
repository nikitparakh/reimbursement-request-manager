import { describe, expect, it } from "vitest";
import {
  getAdminReimbursementsDescription,
  getAdminTeamRequestsDescription,
  getDashboardTeamRegistrationsDescription,
  getTeamOverviewDescription,
  getTeamReimbursementsDescription,
  getUnauthorizedPageContent,
} from "@/lib/ui-copy";

describe("UI copy helpers", () => {
  it("uses sign-in copy for signed-out unauthorized users", () => {
    expect(getUnauthorizedPageContent(false)).toEqual({
      title: "Unauthorized",
      description: "You need to sign in to access this page.",
      actionHref: "/sign-in",
      actionLabel: "Sign in",
    });
  });

  it("uses permission-denied copy for signed-in unauthorized users", () => {
    expect(getUnauthorizedPageContent(true)).toEqual({
      title: "Forbidden",
      description: "You are signed in, but your account does not have permission to access this page.",
      actionHref: "/",
      actionLabel: "Back to dashboard",
    });
  });

  it("describes reimbursement scope for global and scoped admins", () => {
    expect(getAdminReimbursementsDescription(true)).toBe(
      "View and manage reimbursement requests across all teams."
    );
    expect(getAdminReimbursementsDescription(false)).toBe(
      "View and manage reimbursement requests across teams in your managed scope."
    );
  });

  it("describes team registration scope for global and scoped admins", () => {
    expect(getAdminTeamRequestsDescription(true)).toBe(
      "Review and approve new team registration requests across all districts."
    );
    expect(getAdminTeamRequestsDescription(false)).toBe(
      "Review and approve new team registration requests inside your managed scope."
    );
    expect(getDashboardTeamRegistrationsDescription(true)).toBe(
      "Review pending team requests across all districts."
    );
    expect(getDashboardTeamRegistrationsDescription(false)).toBe(
      "Review pending team requests inside your managed scope."
    );
  });

  it("describes coach-style pages by the user's actual scope", () => {
    expect(getTeamOverviewDescription({ isCoach: true, canManageReimbursements: false, isSuperAdmin: false })).toBe(
      "View your team details, requests, and members."
    );
    expect(getTeamOverviewDescription({ isCoach: false, canManageReimbursements: true, isSuperAdmin: false })).toBe(
      "View team details, requests, and members for teams in your managed scope."
    );
    expect(getTeamReimbursementsDescription({ isCoach: false, canManageReimbursements: true, isSuperAdmin: true })).toBe(
      "View and manage reimbursement requests across all teams."
    );
  });
});
