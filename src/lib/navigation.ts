import {
  canManageReimbursements,
  type AccessContext,
  type AccessTarget,
} from "@/lib/access";

type NavLink = {
  href: string;
  label: string;
  prefetch?: boolean;
};

export function getRequestDetailHref(
  context: AccessContext,
  requestId: string,
  // Required: the request's scope. Routing must be decided against the specific
  // request, never the global canManageReimbursements flag (a scoped admin can
  // manage some requests but not others).
  target: AccessTarget
) {
  const useAdminRoute = canManageReimbursements(context, target);

  return useAdminRoute
    ? `/admin/requests/${requestId}`
    : `/user/requests/${requestId}`;
}

export function getNavigationLinks(
  context: Pick<
    AccessContext,
    | "canManageReimbursements"
    | "canManageTeams"
    | "canManageTeamRequests"
    | "canManageUsers"
    | "isCoach"
    | "isParentMentor"
  >
) {
  const links = new Map<string, NavLink>();

  function addLink(
    href: string,
    label: string,
    options?: Pick<NavLink, "prefetch">
  ) {
    if (!links.has(href)) {
      links.set(href, { href, label, ...options });
    }
  }

  if (context.canManageReimbursements) {
    addLink("/admin/inbox", "Admin Inbox", { prefetch: false });
    addLink("/admin/requests", "Reimbursements", { prefetch: false });
  }

  if (context.canManageTeams) {
    addLink("/admin/teams", "Manage Teams", { prefetch: false });
  }

  if (context.canManageTeamRequests) {
    addLink("/admin/team-requests", "Team Registrations", {
      prefetch: false,
    });
  }

  if (context.canManageUsers) {
    addLink("/admin/users", "Manage Users", { prefetch: false });
  }

  if (context.isCoach) {
    addLink("/coach/inbox", "Inbox");
    addLink("/coach/team-overview", "Team Overview");
    addLink("/coach/team-reimbursements", "Team Reimbursements");
  }

  if (context.isParentMentor) {
    addLink("/team", "My Team");
  }

  if (context.isCoach || context.isParentMentor) {
    addLink("/user/requests/new", "New Request");
  }

  // "My Requests" lists the user's OWN submissions at /user/requests. That route
  // redirects coaches to /coach/team-reimbursements and admins to /admin/requests,
  // so only link it for a pure parent/mentor — otherwise the link bounces.
  if (
    context.isParentMentor &&
    !context.isCoach &&
    !context.canManageReimbursements
  ) {
    addLink("/user/requests", "My Requests");
  }

  // Profile holds mailing address + Zelle payout details. Only users who can
  // actually be reimbursed (coaches and parent/mentors who submit requests)
  // need it — pure admins never get paid out.
  if (context.isCoach || context.isParentMentor) {
    addLink("/profile", "Profile");
    addLink("/policy", "Policy");
  }

  return Array.from(links.values());
}
