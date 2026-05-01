CREATE TABLE "District" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "gradeRangeLabel" TEXT,
    "ageRangeLabel" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "School" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "districtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "School_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "District_name_key" ON "District"("name");
CREATE UNIQUE INDEX "District_slug_key" ON "District"("slug");
CREATE UNIQUE INDEX "Program_code_key" ON "Program"("code");
CREATE UNIQUE INDEX "School_districtId_slug_key" ON "School"("districtId", "slug");
CREATE UNIQUE INDEX "School_districtId_name_key" ON "School"("districtId", "name");

INSERT INTO "District" ("id", "name", "slug", "active", "updatedAt")
VALUES (
    'legacy-district',
    'Legacy District',
    'legacy-district',
    true,
    CURRENT_TIMESTAMP
);

INSERT INTO "Program" ("id", "code", "name", "description", "active", "updatedAt")
VALUES (
    'legacy-program',
    'LEGACY',
    'Legacy Program',
    'Placeholder program used while migrated pre-refactor data is reclassified into an active program.',
    false,
    CURRENT_TIMESTAMP
);

INSERT INTO "School" ("id", "districtId", "name", "slug", "active", "updatedAt")
VALUES (
    'legacy-school',
    'legacy-district',
    'Legacy School',
    'legacy-school',
    true,
    CURRENT_TIMESTAMP
);

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "mailingAddressLine1" TEXT,
    "mailingAddressLine2" TEXT,
    "mailingCity" TEXT,
    "mailingState" TEXT,
    "mailingPostalCode" TEXT,
    "zelleType" TEXT,
    "zelleValue" TEXT,
    "policyAcceptedAt" DATETIME,
    "policyVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_User" (
    "createdAt",
    "email",
    "emailVerified",
    "id",
    "image",
    "name",
    "onboardingDone",
    "passwordHash",
    "role",
    "updatedAt"
)
SELECT
    "createdAt",
    "email",
    "emailVerified",
    "id",
    "image",
    "name",
    "onboardingDone",
    "passwordHash",
    CASE
        WHEN "role" = 'ADMIN' THEN 'SUPER_ADMIN'
        WHEN "role" = 'SUPER_ADMIN' THEN 'SUPER_ADMIN'
        ELSE 'USER'
    END,
    "updatedAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT,
    "glAccount" TEXT,
    "fllDivision" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Team" (
    "active",
    "createdAt",
    "fllDivision",
    "glAccount",
    "id",
    "name",
    "programId",
    "schoolId",
    "shortCode",
    "updatedAt"
)
SELECT
    "active",
    "createdAt",
    NULL,
    "glAccount",
    "id",
    "name",
    'legacy-program',
    'legacy-school',
    "shortCode",
    "updatedAt"
FROM "Team";

DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE INDEX "Team_schoolId_programId_active_idx" ON "Team"("schoolId", "programId", "active");
CREATE UNIQUE INDEX "Team_schoolId_programId_name_key" ON "Team"("schoolId", "programId", "name");
CREATE UNIQUE INDEX "Team_schoolId_shortCode_key" ON "Team"("schoolId", "shortCode");

CREATE TABLE "new_TeamMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roleInTeam" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_TeamMembership" (
    "approved",
    "createdAt",
    "id",
    "roleInTeam",
    "teamId",
    "updatedAt",
    "userId"
)
SELECT
    "approved",
    "createdAt",
    "id",
    CASE
        WHEN "roleInTeam" = 'STUDENT' THEN 'PARENT_MENTOR'
        ELSE "roleInTeam"
    END,
    "teamId",
    "updatedAt",
    "userId"
FROM "TeamMembership";

DROP TABLE "TeamMembership";
ALTER TABLE "new_TeamMembership" RENAME TO "TeamMembership";
CREATE UNIQUE INDEX "TeamMembership_userId_teamId_roleInTeam_key" ON "TeamMembership"("userId", "teamId", "roleInTeam");
CREATE INDEX "TeamMembership_teamId_roleInTeam_idx" ON "TeamMembership"("teamId", "roleInTeam");

CREATE TABLE "new_TeamRegistrationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "districtId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "shortCode" TEXT,
    "glAccount" TEXT,
    "fllDivision" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    "approvedTeamId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamRegistrationRequest_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamRegistrationRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamRegistrationRequest_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamRegistrationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamRegistrationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamRegistrationRequest_approvedTeamId_fkey" FOREIGN KEY ("approvedTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_TeamRegistrationRequest" (
    "approvedTeamId",
    "createdAt",
    "districtId",
    "fllDivision",
    "glAccount",
    "id",
    "notes",
    "programId",
    "rejectionReason",
    "requestedById",
    "reviewedAt",
    "reviewedById",
    "schoolId",
    "shortCode",
    "status",
    "teamName",
    "updatedAt"
)
SELECT
    "approvedTeamId",
    "createdAt",
    'legacy-district',
    NULL,
    "glAccount",
    "id",
    "notes",
    'legacy-program',
    "rejectionReason",
    "requestedById",
    "reviewedAt",
    "reviewedById",
    'legacy-school',
    "shortCode",
    "status",
    "teamName",
    "updatedAt"
FROM "TeamRegistrationRequest";

DROP TABLE "TeamRegistrationRequest";
ALTER TABLE "new_TeamRegistrationRequest" RENAME TO "TeamRegistrationRequest";
CREATE UNIQUE INDEX "TeamRegistrationRequest_approvedTeamId_key" ON "TeamRegistrationRequest"("approvedTeamId");
CREATE INDEX "TeamRegistrationRequest_status_createdAt_idx" ON "TeamRegistrationRequest"("status", "createdAt");
CREATE INDEX "TeamRegistrationRequest_districtId_schoolId_programId_status_idx" ON "TeamRegistrationRequest"("districtId", "schoolId", "programId", "status");

CREATE TABLE "new_ReimbursementRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requestedTotal" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "teamId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "coachId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReimbursementRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReimbursementRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReimbursementRequest_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_ReimbursementRequest" (
    "coachId",
    "createdAt",
    "createdById",
    "description",
    "id",
    "requestedTotal",
    "status",
    "submittedAt",
    "teamId",
    "title",
    "updatedAt"
)
SELECT
    "managerId",
    "createdAt",
    "createdById",
    "description",
    "id",
    "requestedTotal",
    "status",
    "submittedAt",
    "teamId",
    "title",
    "updatedAt"
FROM "ReimbursementRequest";

DROP TABLE "ReimbursementRequest";
ALTER TABLE "new_ReimbursementRequest" RENAME TO "ReimbursementRequest";
CREATE INDEX "ReimbursementRequest_teamId_status_createdAt_idx" ON "ReimbursementRequest"("teamId", "status", "createdAt");
CREATE INDEX "ReimbursementRequest_coachId_status_idx" ON "ReimbursementRequest"("coachId", "status");

CREATE TABLE "UserScopeRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "districtId" TEXT,
    "schoolId" TEXT,
    "programId" TEXT,
    "teamId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserScopeRole_has_scope" CHECK (
      "districtId" IS NOT NULL OR
      "schoolId" IS NOT NULL OR
      "programId" IS NOT NULL OR
      "teamId" IS NOT NULL
    ),
    CONSTRAINT "UserScopeRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserScopeRole_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserScopeRole_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserScopeRole_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserScopeRole_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UserScopeRole_userId_role_idx" ON "UserScopeRole"("userId", "role");
CREATE UNIQUE INDEX "UserScopeRole_userId_role_scopeKey_key" ON "UserScopeRole"("userId", "role", "scopeKey");
CREATE INDEX "UserScopeRole_districtId_role_idx" ON "UserScopeRole"("districtId", "role");
CREATE INDEX "UserScopeRole_schoolId_role_idx" ON "UserScopeRole"("schoolId", "role");
CREATE INDEX "UserScopeRole_programId_role_idx" ON "UserScopeRole"("programId", "role");
CREATE INDEX "UserScopeRole_teamId_role_idx" ON "UserScopeRole"("teamId", "role");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
