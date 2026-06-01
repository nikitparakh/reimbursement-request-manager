import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/db";
import { notifications } from "@/db/schema";
import { getRequestDetailHref } from "@/lib/navigation";
import { getRequestAccess } from "@/lib/reimbursements/request-access";
import { requireUser } from "@/lib/rbac";

// The bell renders at most this many notifications. We keep `unreadCount`
// aligned with what is actually reachable in this list so a user with a large
// unread backlog can always clear the badge by reading what they can see
// (instead of a badge that counts unread rows the UI never surfaces).
const NOTIFICATION_LIMIT = 20;

export async function GET() {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [access, notificationRows] = await Promise.all([
    getAccessContext(userId),
    db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: desc(notifications.createdAt),
      limit: NOTIFICATION_LIMIT,
      with: {
        request: {
          columns: {
            id: true,
            teamId: true,
          },
          with: {
            team: {
              columns: {
                schoolId: true,
                programId: true,
              },
              with: {
                school: {
                  columns: {
                    districtId: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  // Resolve per-request view access for the recipient so a notification whose
  // request the recipient can no longer view (e.g. after a scope/coach change)
  // renders a non-clickable (null) href instead of deep-linking to a page that
  // would `notFound()`. The routing decision is made against the SPECIFIC
  // request, never the global `isCoach` flag.
  const distinctRequestIds = Array.from(
    new Set(
      notificationRows
        .map((row) => row.requestId)
        .filter((requestId): requestId is string => Boolean(requestId))
    )
  );

  const accessByRequestId = new Map<string, boolean>();
  await Promise.all(
    distinctRequestIds.map(async (requestId) => {
      const requestAccess = await getRequestAccess(userId, requestId);
      accessByRequestId.set(requestId, Boolean(requestAccess?.canView));
    })
  );

  return NextResponse.json({
    notifications: notificationRows.map(({ request, ...notification }) => ({
      ...notification,
      requestHref:
        request &&
        notification.requestId &&
        accessByRequestId.get(notification.requestId)
          ? // A coach reviewing a freshly-submitted request reaches it through
            // the coach/user detail route, not the admin dashboard, even when
            // they also hold an admin scope over the same request. The link is
            // still gated on per-request canView above, so a stale isCoach flag
            // can never deep-link to a request the viewer can no longer open.
            notification.event === "REQUEST_SUBMITTED" && access.isCoach
            ? `/user/requests/${notification.requestId}`
            : getRequestDetailHref(access, notification.requestId, {
                districtId: request.team.school.districtId,
                schoolId: request.team.schoolId,
                programId: request.team.programId,
                teamId: request.teamId,
              })
          : null,
    })),
    unreadCount: notificationRows.filter((row) => !row.read).length,
  });
}

// Mark all of the caller's unread notifications as read, so a user with more
// unread rows than the bell can display is still able to clear the badge.
export async function POST() {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

  return NextResponse.json({ ok: true });
}
