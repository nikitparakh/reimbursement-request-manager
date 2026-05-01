# UI Sensibility Audit

This report summarizes the role-by-role UI sensibility audit of the VelTest reimbursement app. The audit focused on whether dashboard views, tables, lists, cards, filters, and actions are cohesive and sensible for each user type.

## Audit Scope

Audited user types:

- Signed-out visitor
- Signed-in base user with no team membership or admin scope
- Parent/Mentor
- Coach
- Program Admin
- School Admin
- Super Admin

Primary areas reviewed:

- Dashboard cards and navigation
- Reimbursement request lists and detail pages
- Team roster and team management views
- Team registration queues
- User management views
- Profile, policy, and notifications
- Table columns, filters, row actions, empty states, status labels, and accessibility

## Audit Caveats

The local environment had competing dev servers and auth URL mismatches during the audit. In particular, `localhost:3001` could resolve to a different local service, and some later browser audits against `127.0.0.1:3011` hit `NEXTAUTH_URL` / callback issues.

Because of that:

- Visitor, base user, parent/mentor, and coach findings include direct browser evidence.
- Program admin, school admin, and super admin findings include a mix of prior browser evidence, source inspection, and component-level review.
- The reported UI issues are still actionable because they map to visible UI components and implemented route surfaces, but a final verification pass should run against one clean local server with matching `APP_URL` and `NEXTAUTH_URL`.

## Executive Summary

The app has a solid role-aware access model, but the UI presentation is not yet as cohesive as the permissions model. The main pattern is that several roles see overlapping ways to manage the same concepts, especially reimbursements and team registrations. Tables are powerful but dense, status labels often expose workflow enum language, and some views use the same component vocabulary for different domain meanings.

The highest-impact improvements are:

- Normalize user-facing status labels.
- Separate active/inactive team state from reimbursement approval language.
- Clarify the purpose of `Admin Inbox`, `Reimbursements`, and coach-style reimbursement queues.
- Consolidate or clearly distinguish team registration queues.
- Reduce clutter in admin tables and user scope displays.
- Improve discoverability of policy and context pages.
- Improve request detail context for reviewers.

## Cross-Role Findings

### 1. Reimbursement Surfaces Overlap

Admins can encounter multiple reimbursement views:

- `Admin Inbox`
- `Reimbursements`
- Coach-style `Team Reimbursements` when they have reimbursement management access

These views are valid individually, but together they create an unclear mental model. `Admin Inbox` behaves like an action queue with cards and inline decisions. `Reimbursements` behaves like a filtered registry table. `Team Reimbursements` behaves like a coach queue, but can also be reachable by admins.

Recommendation:

- Rename and position the views by job:
  - `Review Queue` for actionable coach/admin review work.
  - `All Reimbursements` or `Request History` for search/reporting.
  - Reserve coach-style pages for coaches, or explicitly label them as scoped team queues when opened by admins.

### 2. Status Language Is Too Internal

Several surfaces expose workflow statuses and audit actions directly:

- `SUBMITTED`
- `COACH_APPROVED`
- `ADMIN_APPROVED`
- `APPROVE`
- `SUBMIT`

These labels are precise for developers but not ideal for parents, mentors, and coaches.

Recommendation:

- Add a display-label layer for statuses and audit actions.
- Example labels:
  - `DRAFT` → `Draft`
  - `SUBMITTED` → `Waiting for coach`
  - `COACH_APPROVED` → `Approved by coach`
  - `ADMIN_APPROVED` → `Approved for payment`
  - `PAID` → `Paid`
  - audit `SUBMIT` → `Submitted`
  - audit `APPROVE` → `Approved`

### 3. Team Active State Uses Approval Badges

Team active/inactive state is presented using reimbursement-style badge values such as `APPROVED` and `REJECTED`. That is confusing because a team being inactive is not the same as a reimbursement or registration being rejected.

Recommendation:

- Use `Active` and `Inactive` labels for team lifecycle state.
- Use neutral or lifecycle-specific badge styling instead of approval/rejection colors.

### 4. Team Registration Workflows Are Duplicated

Team registration requests appear in both:

- `Manage Teams`
- `Team Registrations`

This creates uncertainty about which page is canonical for processing registration requests.

Recommendation:

- Make `Team Registrations` the canonical queue.
- On `Manage Teams`, show a compact summary with a link to the canonical queue, or remove the duplicated pending cards.

### 5. Admin Tables Are Dense

Admin tables expose many controls at once:

- `Reimbursements` has search, status, district, school, program, team, from date, and to date filters.
- `Manage Users` combines global role, scoped roles, scope add/remove controls, and team memberships in one table.
- `Manage Teams` combines identity fields, roster counts, request counts, and state.

Recommendation:

- Collapse less-used filters behind `Advanced filters`.
- Use cascading filters where possible: district → school → program → team.
- Move complex row management into detail pages, drawers, or expanders.
- Keep table rows focused on scan-first information.

### 6. Policy Is Under-Discoverable

The policy page exists and is useful, but it is not consistently available from authenticated navigation.

Recommendation:

- Add `Policy` to authenticated navigation, footer, or profile/help area.
- Also link it from `New Request` because reimbursement rules matter most during request creation.

### 7. Accessibility Needs Attention

Observed accessibility concerns:

- Numeric line-item fields on request detail pages are difficult to distinguish in accessibility snapshots.
- Notification popover content is not consistently exposed to automation and likely needs stronger semantics.
- Some roster/list text concatenates name and email.
- Some tables rely on whole-row click behavior without explicit `View details` affordances.

Recommendation:

- Add explicit labels or `aria-label` values for line-item numeric inputs.
- Add `aria-expanded`, `aria-controls`, and a labelled popover/list pattern to notifications.
- Improve roster markup with clearer name/email separation.
- Consider explicit `View` links in tables where row click is the primary action.

## Role-By-Role Findings

## Signed-Out Visitor

### What Works

- The public landing page is simple and understandable.
- Sign-in and sign-up are easy to find.
- Protected routes redirect to sign-in with a callback URL.
- The policy page is readable and structured.

### Issues

- The landing page duplicates `Sign In` and `Create Account` in both the navbar and hero section.
- Copy casing drifts between `Sign In`, `Sign in`, `Create Account`, and `Create an account`.
- The policy is not discoverable from the landing page until a visitor reaches sign-up.
- Auth pages use a different structural pattern than the landing and policy pages.

### Recommendations

- Keep one clear CTA area, or visually demote duplicate nav/hero auth links.
- Normalize sign-in/sign-up copy casing.
- Add a policy link to the public footer or public nav.
- Use consistent landmarks/layout structure across public and auth pages.

## Base User

This is a signed-in user with no team membership and no admin scope.

### What Works

- The user is directed toward onboarding.
- Profile is accessible.
- Creating requests is blocked until the user has an approved team membership.
- Forbidden pages now show permission-denied copy rather than sign-in copy.

### Issues

- The dashboard is very thin and only surfaces onboarding.
- `My Requests` and `Policy` are reachable but not discoverable from the base-user dashboard or nav.
- `/team` effectively duplicates onboarding for a user without a team.
- `/user/requests` empty state is a dead end with no next-step CTA.
- `/user/requests/new` explains the membership requirement but does not link directly to onboarding.

### Recommendations

- Add a richer base-user dashboard with:
  - Continue onboarding
  - View request history
  - Read policy
- Redirect `/team` to onboarding for users without a team, or show a lightweight “No team yet” page with a single onboarding CTA.
- Add “Complete setup” links to empty request states and blocked new-request pages.

## Parent/Mentor

### What Works

- The role-specific nav is understandable: `My Team`, `New Request`, `My Requests`, `Profile`.
- The request list gives parents a focused view of their reimbursement history.
- Draft, submitted, and approved request detail pages expose different controls based on status.
- Profile and payment setup are easy to reach.

### Issues

- Request statuses are too backend-oriented.
- Approval history reads like an audit log rather than a user-facing timeline.
- The dashboard repeats nav actions without adding recent activity or status context.
- The team roster display can concatenate names and emails in extracted text.
- The notification bell lacks robust expanded-state semantics.
- Row text in request tables can become a long mashed string for assistive tools.

### Recommendations

- Replace enum-like statuses with parent-friendly labels.
- Rewrite approval history entries as human timeline events.
- Add dashboard context such as “recent requests” or “requests needing action”.
- Improve roster row layout with explicit name/email separation.
- Add accessible notification popover semantics.
- Add explicit `View details` affordances or better row accessibility.

## Coach

### What Works

- The dashboard clearly pushes coaches toward the team queue.
- `Team Overview` gives team context, stats, requests, and members.
- `Team Reimbursements` provides filters and a request queue.
- Submitted request detail exposes review controls.
- Coach nav is focused and concise.

### Issues

- The coach request detail page uses the same `/user/requests/:id` route and similar tooling as submitter pages, which can blur whether the coach is reviewing or editing.
- Review context is not prominent enough. A coach should immediately see whose request they are reviewing and what action is expected.
- `Team Overview` and `Team Reimbursements` use different first-column names for similar concepts (`Title` vs `Receipt Name`).
- Line-item numeric fields need clearer accessible labels.
- `My Team` roster presentation is less polished than admin tables.

### Recommendations

- Add a reviewer banner on request detail pages:
  - requester
  - team
  - current status
  - expected next action
- Harmonize table column naming across coach views.
- Label line-item inputs with field purpose and row context.
- Improve roster layout with two-line name/email rows or a compact table.

## Program Admin

### What Works

- The dashboard program cards help communicate scope.
- `Manage Teams` is scoped to the relevant schools/programs.
- `Manage Users` is not exposed, which matches the role.
- Team registration and reimbursement management are available.

### Issues

- Scope is not consistently visible once the user leaves the dashboard.
- `Admin Inbox` cards do not always show enough district/school/program context.
- `Admin Inbox`, `Reimbursements`, and coach-style reimbursements can feel like overlapping queues.
- Program admins may be authorized for coach-style reimbursement pages without a clear nav entry or explanation.
- Registration cards are duplicated across team and registration pages.

### Recommendations

- Add persistent scope context to scoped admin pages.
- Include school/program context on inbox cards.
- Decide whether program admins should use coach-style reimbursement pages; if yes, label them as scoped team queues.
- Consolidate registration processing into one page.

## School Admin

### What Works

- School admins can reach the expected admin surfaces:
  - reimbursements
  - teams
  - team registrations
  - users
- The dashboard gives a school/program breakdown.
- User management correctly limits super-admin role controls after the recent fixes.

### Issues

- This role has the busiest UI.
- `Manage Users` rows can become tall and cluttered with scope badges, role controls, and team badges.
- `Reimbursements` has many filters at once.
- Team registration queues are duplicated.
- Team active state is labelled using approval/rejection vocabulary.
- The admin reimbursement table hides key hierarchy columns on smaller viewports.

### Recommendations

- Move scope management into an expand/collapse section, drawer, or dedicated user detail page.
- Summarize scope counts in the table row, such as `3 program scopes`, then expand for detail.
- Collapse advanced reimbursement filters.
- Preserve team/school/program context on smaller viewports using a secondary row under the title.
- Rename team lifecycle badges to `Active` and `Inactive`.

## Super Admin

### What Works

- The super admin has access to the expected global surfaces.
- Dashboard cards provide a high-level platform entry point and scoped program drill-downs.
- `Manage Users` exposes global role management.
- `Manage Teams` and `Reimbursements` provide global operational access.

### Issues

- The global data views can feel overwhelming.
- Super admin sees the same dense tables as scoped admins but with more data.
- Scope-related copy can still feel oriented toward scoped admins if not carefully differentiated.
- `Manage Users` combines global roles, scoped roles, and team memberships into a single dense table.
- The distinction between workflow queue and historical registry is not strong enough.

### Recommendations

- Add saved views or presets for global admins.
- Make dashboard cards more strategic:
  - pending approvals
  - unpaid approved requests
  - pending team registrations
  - users needing scope review
- Separate user identity, global access, scoped access, and team membership into clearer subviews.
- Rename reimbursement pages to clarify intent:
  - `Review Queue`
  - `Request Registry`
  - `Payment Queue`

## Table-Specific Notes

## My Requests / Team Reimbursements Tables

Observed strengths:

- Search and status filtering are useful.
- Date filters are now labelled.
- Row click makes the table fast for frequent users.

Issues:

- `Receipt Name` may not match the domain concept if the row is really a reimbursement request title.
- Whole-row click lacks explicit affordance.
- Status values need friendlier labels.

Recommendations:

- Rename `Receipt Name` to `Request` or `Request Title`.
- Add a final `View` column or visible details link.
- Use display labels for statuses.

## Admin Reimbursements Table

Observed strengths:

- Powerful filters.
- Useful columns for cross-team visibility.
- Row click opens admin detail.

Issues:

- Filter row is visually heavy.
- District/school/program/team filters are not cascaded.
- Key context hides on smaller screens.

Recommendations:

- Collapse advanced filters.
- Cascade filters.
- Add a compact secondary metadata line on small screens.

## Manage Teams Table

Observed strengths:

- Team identity, school/program, roster counts, request counts, and state are all visible.
- Team detail pages provide useful drill-down.

Issues:

- Active/inactive state uses approval labels.
- Pending registration cards on the same page compete with team management.

Recommendations:

- Use `Active` / `Inactive`.
- Move pending registrations to the canonical registrations page or convert to a small alert summary.

## Manage Users Table

Observed strengths:

- Exposes all relevant relationships: global role, scoped role, team membership.
- Search and role filters are useful.

Issues:

- Rows become dense quickly.
- Scope badges contain long repeated labels.
- Inline scope management makes the table feel like a control panel rather than a scan-first list.

Recommendations:

- Show compact summaries in the table:
  - `Global: User`
  - `Scopes: 4`
  - `Teams: 2`
- Move detailed scope add/remove controls to an expanded row, modal, drawer, or user detail page.

## Prioritized Action Plan

### Priority 1

- Replace team active-state badges with `Active` / `Inactive`.
- Add user-facing status label mapping for reimbursement statuses and approval history.
- Add reviewer context banners on request detail pages for coaches and admins.

### Priority 2

- Clarify reimbursement information architecture:
  - queue vs registry vs payment workflow.
- Consolidate team registration processing into one canonical location.
- Add policy to authenticated navigation or profile/help area.

### Priority 3

- Reduce admin table clutter with collapsible filters and compact summaries.
- Redesign `Manage Users` to make scope management less inline and less badge-heavy.
- Improve roster and notification accessibility.

### Priority 4

- Add dashboard summaries tailored to each role:
  - Parent/Mentor: recent requests and next actions
  - Coach: pending reviews
  - Program/School Admin: scoped pending approvals and registrations
  - Super Admin: global workload summaries

## Suggested Follow-Up Verification

Before making another browser audit pass:

- Stop competing dev servers.
- Start one VelTest dev server on a known port.
- Set `APP_URL` and `NEXTAUTH_URL` to that exact origin.
- Use `127.0.0.1` or `localhost` consistently.
- Confirm sign-in works once for each seeded account.

Then run a shorter final browser verification focused on the highest-priority UI changes.
