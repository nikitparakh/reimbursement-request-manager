import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/db";
import { notifications } from "@/db/schema";
import { getRequestDetailHref } from "@/lib/navigation";
import { requireUser } from "@/lib/rbac";

export async function GET() {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [access, notificationRows, unreadCount] = await Promise.all([
    getAccessContext(userId),
    db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: desc(notifications.createdAt),
      limit: 20,
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
    db.$count(notifications, and(eq(notifications.userId, userId), eq(notifications.read, false))),
  ]);

  return NextResponse.json({
    notifications: notificationRows.map(({ request, ...notification }) => ({
      ...notification,
      requestHref:
        request && notification.requestId
          ? notification.event === "REQUEST_SUBMITTED" && access.isCoach
            ? `/user/requests/${notification.requestId}`
            : getRequestDetailHref(access, notification.requestId, {
                districtId: request.team.school.districtId,
                schoolId: request.team.schoolId,
                programId: request.team.programId,
                teamId: request.teamId,
              })
          : null,
    })),
    unreadCount,
  });
}
