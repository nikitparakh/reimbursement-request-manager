import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/db";
import { getRequestDetailHref } from "@/lib/navigation";
import { requireUser } from "@/lib/rbac";

export async function GET() {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [access, notifications, unreadCount] = await Promise.all([
    getAccessContext(userId),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        request: {
          select: {
            id: true,
            teamId: true,
            team: {
              select: {
                schoolId: true,
                programId: true,
                school: {
                  select: {
                    districtId: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.notification.count({
      where: { userId, read: false },
    }),
  ]);

  return NextResponse.json({
    notifications: notifications.map(({ request, ...notification }) => ({
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
