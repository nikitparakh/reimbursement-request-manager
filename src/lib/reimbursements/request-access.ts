import { eq } from "drizzle-orm";
import { canManageReimbursements, getAccessContext } from "@/lib/access";
import { db } from "@/lib/db";
import { reimbursementRequests } from "@/db/schema";

type RequestAccess = {
  userId: string;
  request: {
    id: string;
    title: string;
    teamId: string;
    createdById: string;
    coachId: string | null;
    status: string;
    team: {
      id: string;
      schoolId: string;
      programId: string;
      school: {
        districtId: string;
      };
    };
  };
  isOwner: boolean;
  isReimbursementAdmin: boolean;
  isCoach: boolean;
  isTeamMember: boolean;
  canView: boolean;
  canEditDraft: boolean;
  canEditLineItems: boolean;
  canCommentOnLineItems: boolean;
  canReopen: boolean;
  canDownloadPdf: boolean;
  redirectUrl: string;
};

export async function getRequestAccess(userId: string, requestId: string) {
  const [context, request] = await Promise.all([
    getAccessContext(userId),
    db.query.reimbursementRequests.findFirst({
      where: eq(reimbursementRequests.id, requestId),
      columns: {
        id: true,
        title: true,
        teamId: true,
        createdById: true,
        coachId: true,
        status: true,
      },
      with: {
        team: {
          columns: {
            id: true,
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
    }),
  ]);

  if (!request) {
    return null;
  }

  const memberships = context.teamMemberships.filter(
    (membership) => membership.teamId === request.teamId
  );

  const isOwner = request.createdById === userId;
  const isTeamMember = memberships.length > 0;
  const isCoach = memberships.some((membership) => membership.roleInTeam === "COACH");
  const isReimbursementAdmin = canManageReimbursements(context, {
    districtId: request.team.school.districtId,
    schoolId: request.team.schoolId,
    programId: request.team.programId,
    teamId: request.teamId,
  });

  const canEditLineItems =
    request.status === "DRAFT"
      ? isOwner || isCoach || isReimbursementAdmin
      : request.status === "SUBMITTED"
        ? isCoach || isReimbursementAdmin
        : request.status === "COACH_APPROVED"
          ? isReimbursementAdmin
          : false;

  const canCommentOnLineItems =
    (request.status === "SUBMITTED" && (isCoach || isReimbursementAdmin)) ||
    (request.status === "COACH_APPROVED" && isReimbursementAdmin);

  return {
    userId,
    request,
    isOwner,
    isReimbursementAdmin,
    isCoach,
    isTeamMember,
    canView: isOwner || isReimbursementAdmin || isTeamMember,
    canEditDraft:
      request.status === "DRAFT" && (isOwner || isCoach || isReimbursementAdmin),
    canEditLineItems,
    canCommentOnLineItems,
    canReopen:
      (request.status === "COACH_REJECTED" ||
        request.status === "ADMIN_REJECTED") &&
      (isOwner || isCoach || isReimbursementAdmin),
    canDownloadPdf: isOwner || isReimbursementAdmin || isTeamMember,
    redirectUrl: isReimbursementAdmin
      ? "/admin/requests"
      : isCoach
        ? "/coach/team-reimbursements"
        : "/user/requests",
  } satisfies RequestAccess;
}
