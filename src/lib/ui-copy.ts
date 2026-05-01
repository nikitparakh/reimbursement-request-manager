type CoachStyleCopyInput = {
  isCoach: boolean;
  canManageReimbursements: boolean;
  isSuperAdmin: boolean;
};

export function getUnauthorizedPageContent(isSignedIn: boolean) {
  return isSignedIn
    ? {
        title: "Forbidden",
        description:
          "You are signed in, but your account does not have permission to access this page.",
        actionHref: "/",
        actionLabel: "Back to dashboard",
      }
    : {
        title: "Unauthorized",
        description: "You need to sign in to access this page.",
        actionHref: "/sign-in",
        actionLabel: "Sign in",
      };
}

export function getAdminReimbursementsDescription(isSuperAdmin: boolean) {
  return isSuperAdmin
    ? "View and manage reimbursement requests across all teams."
    : "View and manage reimbursement requests across teams in your managed scope.";
}

export function getAdminTeamRequestsDescription(isSuperAdmin: boolean) {
  return isSuperAdmin
    ? "Review and approve new team registration requests across all districts."
    : "Review and approve new team registration requests inside your managed scope.";
}

export function getDashboardTeamRegistrationsDescription(isSuperAdmin: boolean) {
  return isSuperAdmin
    ? "Review pending team requests across all districts."
    : "Review pending team requests inside your managed scope.";
}

export function getTeamOverviewDescription({
  isCoach,
  canManageReimbursements,
  isSuperAdmin,
}: CoachStyleCopyInput) {
  if (isSuperAdmin) {
    return "View team details, requests, and members across all teams.";
  }
  if (canManageReimbursements && !isCoach) {
    return "View team details, requests, and members for teams in your managed scope.";
  }
  if (canManageReimbursements) {
    return "View team details, requests, and members for your coached and managed teams.";
  }
  return "View your team details, requests, and members.";
}

export function getTeamReimbursementsDescription({
  isCoach,
  canManageReimbursements,
  isSuperAdmin,
}: CoachStyleCopyInput) {
  if (isSuperAdmin) {
    return "View and manage reimbursement requests across all teams.";
  }
  if (canManageReimbursements && !isCoach) {
    return "View and manage reimbursement requests across teams in your managed scope.";
  }
  if (canManageReimbursements) {
    return "View and manage reimbursement requests across your coached and managed teams.";
  }
  return "View and manage reimbursement requests across your coached teams.";
}
