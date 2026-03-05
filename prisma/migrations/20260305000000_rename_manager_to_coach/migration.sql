-- Rename MANAGER → COACH in GlobalRole (User.role)
UPDATE "User" SET "role" = 'COACH' WHERE "role" = 'MANAGER';

-- Rename MANAGER → COACH in TeamMembershipRole (TeamMembership.roleInTeam)
UPDATE "TeamMembership" SET "roleInTeam" = 'COACH' WHERE "roleInTeam" = 'MANAGER';

-- Rename MANAGER_APPROVED → COACH_APPROVED and MANAGER_REJECTED → COACH_REJECTED in RequestStatus
UPDATE "ReimbursementRequest" SET "status" = 'COACH_APPROVED' WHERE "status" = 'MANAGER_APPROVED';
UPDATE "ReimbursementRequest" SET "status" = 'COACH_REJECTED' WHERE "status" = 'MANAGER_REJECTED';

-- Update notification events referencing old status names
UPDATE "Notification" SET "event" = 'COACH_APPROVED' WHERE "event" = 'MANAGER_APPROVED';
UPDATE "Notification" SET "event" = 'COACH_REJECTED' WHERE "event" = 'MANAGER_REJECTED';
