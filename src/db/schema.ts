import { nanoid } from "nanoid";
import { relations } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Money is stored as integer cents in D1 but read/written as a dollar `number`
 * by the application, so existing dollar-based arithmetic and the API contract
 * are unchanged. (Decision: integer-cents storage, §9 of the migration plan.)
 */
const money = customType<{ data: number; driverData: number }>({
  dataType: () => "integer",
  // Deterministic dollars -> cents. Reject non-finite values (NaN/Infinity)
  // rather than silently coercing them to 0, which would corrupt totals.
  // Negative values are intentionally allowed (line items carry negative
  // discounts), so we do NOT floor at 0 here.
  toDriver: (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("Invalid money value: expected a finite number");
    }
    // toFixed(2) before rounding keeps the dollars<->cents conversion
    // deterministic and avoids binary floating-point drift.
    return Math.round(Number(value.toFixed(2)) * 100);
  },
  fromDriver: (value) => value / 100,
});

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid());

const createdAt = () =>
  integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

// ----------------------------------------------------------------------------
// Enums (SQLite has no native enums — stored as TEXT with a check list)
// ----------------------------------------------------------------------------
export const GLOBAL_ROLES = ["USER", "SUPER_ADMIN"] as const;
export const SCOPED_ROLES = [
  "SCHOOL_ADMIN",
  "PROGRAM_ADMIN",
  "COACH",
  "PARENT_MENTOR",
] as const;
export const TEAM_MEMBERSHIP_ROLES = ["PARENT_MENTOR", "COACH"] as const;
export const PROGRAM_CODES = ["LEGACY", "FLL", "FTC", "FRC"] as const;
export const FLL_DIVISIONS = ["DISCOVER", "EXPLORE", "CHALLENGE"] as const;
export const TEAM_REGISTRATION_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export const REQUEST_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "COACH_APPROVED",
  "COACH_REJECTED",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "PAID",
] as const;
export const PARSE_STATUSES = ["QUEUED", "PROCESSING", "DONE", "FAILED"] as const;
export const DOCUMENT_TYPES = [
  "RECEIPT",
  "INVOICE",
  "W9",
  "CHECK_REQUEST_FORM",
  "OTHER",
] as const;
export const DECISION_ACTIONS = [
  "APPROVE",
  "REJECT",
  "REOPEN",
  "MARK_PAID",
  "SUBMIT",
] as const;

export type GlobalRole = (typeof GLOBAL_ROLES)[number];
export type ScopedRole = (typeof SCOPED_ROLES)[number];
export type TeamMembershipRole = (typeof TEAM_MEMBERSHIP_ROLES)[number];
export type ProgramCode = (typeof PROGRAM_CODES)[number];
export type FllDivision = (typeof FLL_DIVISIONS)[number];
export type TeamRegistrationStatus = (typeof TEAM_REGISTRATION_STATUSES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type ParseStatus = (typeof PARSE_STATUSES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

// ----------------------------------------------------------------------------
// Tables
// ----------------------------------------------------------------------------
export const users = sqliteTable("User", {
  id: id(),
  name: text("name"),
  email: text("email").notNull().unique(),
  clerkUserId: text("clerkUserId").unique(),
  role: text("role", { enum: GLOBAL_ROLES }).notNull().default("USER"),
  onboardingDone: integer("onboardingDone", { mode: "boolean" })
    .notNull()
    .default(false),
  mailingAddressLine1: text("mailingAddressLine1"),
  mailingAddressLine2: text("mailingAddressLine2"),
  mailingCity: text("mailingCity"),
  mailingState: text("mailingState"),
  mailingPostalCode: text("mailingPostalCode"),
  zelleType: text("zelleType"),
  zelleValue: text("zelleValue"),
  policyAcceptedAt: integer("policyAcceptedAt", { mode: "timestamp" }),
  policyVersion: text("policyVersion"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const districts = sqliteTable("District", {
  id: id(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const schools = sqliteTable(
  "School",
  {
    id: id(),
    districtId: text("districtId")
      .notNull()
      .references(() => districts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("School_districtId_slug_key").on(t.districtId, t.slug),
    uniqueIndex("School_districtId_name_key").on(t.districtId, t.name),
  ],
);

export const programs = sqliteTable("Program", {
  id: id(),
  code: text("code", { enum: PROGRAM_CODES }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  gradeRangeLabel: text("gradeRangeLabel"),
  ageRangeLabel: text("ageRangeLabel"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userScopeRoles = sqliteTable(
  "UserScopeRole",
  {
    id: id(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: SCOPED_ROLES }).notNull(),
    districtId: text("districtId").references(() => districts.id, {
      onDelete: "cascade",
    }),
    schoolId: text("schoolId").references(() => schools.id, {
      onDelete: "cascade",
    }),
    programId: text("programId").references(() => programs.id, {
      onDelete: "cascade",
    }),
    teamId: text("teamId").references(() => teams.id, { onDelete: "cascade" }),
    scopeKey: text("scopeKey").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("UserScopeRole_userId_role_scopeKey_key").on(
      t.userId,
      t.role,
      t.scopeKey,
    ),
    index("UserScopeRole_userId_role_idx").on(t.userId, t.role),
    index("UserScopeRole_districtId_role_idx").on(t.districtId, t.role),
    index("UserScopeRole_schoolId_role_idx").on(t.schoolId, t.role),
    index("UserScopeRole_programId_role_idx").on(t.programId, t.role),
    index("UserScopeRole_teamId_role_idx").on(t.teamId, t.role),
  ],
);

export const teams = sqliteTable(
  "Team",
  {
    id: id(),
    schoolId: text("schoolId")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    programId: text("programId")
      .notNull()
      .references(() => programs.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    shortCode: text("shortCode"),
    glAccount: text("glAccount"),
    fllDivision: text("fllDivision", { enum: FLL_DIVISIONS }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("Team_schoolId_programId_name_key").on(
      t.schoolId,
      t.programId,
      t.name,
    ),
    uniqueIndex("Team_schoolId_shortCode_key").on(t.schoolId, t.shortCode),
    index("Team_schoolId_programId_active_idx").on(
      t.schoolId,
      t.programId,
      t.active,
    ),
  ],
);

export const teamMemberships = sqliteTable(
  "TeamMembership",
  {
    id: id(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: text("teamId")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    roleInTeam: text("roleInTeam", { enum: TEAM_MEMBERSHIP_ROLES }).notNull(),
    approved: integer("approved", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("TeamMembership_userId_teamId_roleInTeam_key").on(
      t.userId,
      t.teamId,
      t.roleInTeam,
    ),
    index("TeamMembership_teamId_roleInTeam_idx").on(t.teamId, t.roleInTeam),
  ],
);

export const teamRegistrationRequests = sqliteTable(
  "TeamRegistrationRequest",
  {
    id: id(),
    districtId: text("districtId")
      .notNull()
      .references(() => districts.id, { onDelete: "restrict" }),
    schoolId: text("schoolId")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    programId: text("programId")
      .notNull()
      .references(() => programs.id, { onDelete: "restrict" }),
    teamName: text("teamName").notNull(),
    shortCode: text("shortCode"),
    glAccount: text("glAccount"),
    fllDivision: text("fllDivision", { enum: FLL_DIVISIONS }),
    notes: text("notes"),
    status: text("status", { enum: TEAM_REGISTRATION_STATUSES })
      .notNull()
      .default("PENDING"),
    requestedById: text("requestedById")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reviewedById: text("reviewedById").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: integer("reviewedAt", { mode: "timestamp" }),
    rejectionReason: text("rejectionReason"),
    approvedTeamId: text("approvedTeamId")
      .unique()
      .references(() => teams.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("TeamRegistrationRequest_status_createdAt_idx").on(
      t.status,
      t.createdAt,
    ),
    index("TeamRegistrationRequest_scope_status_idx").on(
      t.districtId,
      t.schoolId,
      t.programId,
      t.status,
    ),
  ],
);

export const reimbursementRequests = sqliteTable(
  "ReimbursementRequest",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description"),
    requestedTotal: money("requestedTotal").notNull(),
    status: text("status", { enum: REQUEST_STATUSES }).notNull().default("DRAFT"),
    submittedAt: integer("submittedAt", { mode: "timestamp" }),
    teamId: text("teamId")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    createdById: text("createdById")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    coachId: text("coachId").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("ReimbursementRequest_teamId_status_createdAt_idx").on(
      t.teamId,
      t.status,
      t.createdAt,
    ),
    index("ReimbursementRequest_coachId_status_idx").on(t.coachId, t.status),
  ],
);

export const receiptFiles = sqliteTable(
  "ReceiptFile",
  {
    id: id(),
    requestId: text("requestId")
      .notNull()
      .references(() => reimbursementRequests.id, { onDelete: "cascade" }),
    fileName: text("fileName").notNull(),
    mimeType: text("mimeType").notNull(),
    storageUrl: text("storageUrl").notNull(),
    parseStatus: text("parseStatus", { enum: PARSE_STATUSES })
      .notNull()
      .default("QUEUED"),
    uploadedAt: integer("uploadedAt", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: updatedAt(),
  },
  (t) => [index("ReceiptFile_requestId_parseStatus_idx").on(t.requestId, t.parseStatus)],
);

export const receiptExtractions = sqliteTable("ReceiptExtraction", {
  id: id(),
  receiptFileId: text("receiptFileId")
    .notNull()
    .unique()
    .references(() => receiptFiles.id, { onDelete: "cascade" }),
  documentType: text("documentType", { enum: DOCUMENT_TYPES })
    .notNull()
    .default("OTHER"),
  merchant: text("merchant"),
  receiptDate: integer("receiptDate", { mode: "timestamp" }),
  subtotal: money("subtotal"),
  tax: money("tax"),
  total: money("total"),
  currency: text("currency").default("USD"),
  confidence: real("confidence"),
  flags: text("flags", { mode: "json" }),
  rawJson: text("rawJson", { mode: "json" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const receiptLineItems = sqliteTable(
  "ReceiptLineItem",
  {
    id: id(),
    receiptExtractionId: text("receiptExtractionId")
      .notNull()
      .references(() => receiptExtractions.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    description: text("description").notNull(),
    quantity: real("quantity"),
    unitPrice: money("unitPrice"),
    lineTotal: money("lineTotal"),
    category: text("category"),
    excludedAt: integer("excludedAt", { mode: "timestamp" }),
    excludedById: text("excludedById").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("ReceiptLineItem_receiptExtractionId_position_idx").on(
      t.receiptExtractionId,
      t.position,
    ),
  ],
);

export const lineItemComments = sqliteTable(
  "LineItemComment",
  {
    id: id(),
    lineItemId: text("lineItemId")
      .notNull()
      .references(() => receiptLineItems.id, { onDelete: "cascade" }),
    authorId: text("authorId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("LineItemComment_lineItemId_createdAt_idx").on(t.lineItemId, t.createdAt)],
);

export const approvalActions = sqliteTable(
  "ApprovalAction",
  {
    id: id(),
    requestId: text("requestId")
      .notNull()
      .references(() => reimbursementRequests.id, { onDelete: "cascade" }),
    actorId: text("actorId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: text("action", { enum: DECISION_ACTIONS }).notNull(),
    comment: text("comment"),
    createdAt: createdAt(),
  },
  (t) => [index("ApprovalAction_requestId_createdAt_idx").on(t.requestId, t.createdAt)],
);

export const auditLogs = sqliteTable(
  "AuditLog",
  {
    id: id(),
    actorId: text("actorId").references(() => users.id, { onDelete: "set null" }),
    requestId: text("requestId").references(() => reimbursementRequests.id, {
      onDelete: "set null",
    }),
    eventType: text("eventType").notNull(),
    message: text("message").notNull(),
    metadata: text("metadata", { mode: "json" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("AuditLog_requestId_createdAt_idx").on(t.requestId, t.createdAt),
    index("AuditLog_eventType_createdAt_idx").on(t.eventType, t.createdAt),
  ],
);

export const notifications = sqliteTable(
  "Notification",
  {
    id: id(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    message: text("message").notNull(),
    requestId: text("requestId").references(() => reimbursementRequests.id, {
      onDelete: "set null",
    }),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("Notification_userId_read_createdAt_idx").on(t.userId, t.read, t.createdAt)],
);

// ----------------------------------------------------------------------------
// Relations
// ----------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  scopedRoles: many(userScopeRoles),
  memberships: many(teamMemberships),
  createdRequests: many(reimbursementRequests, { relationName: "RequestCreatedBy" }),
  coachedRequests: many(reimbursementRequests, { relationName: "RequestCoach" }),
  teamRequests: many(teamRegistrationRequests, { relationName: "TeamRequestCreatedBy" }),
  reviewedTeamRequests: many(teamRegistrationRequests, {
    relationName: "TeamRequestReviewedBy",
  }),
  approvals: many(approvalActions),
  auditLogs: many(auditLogs),
  notifications: many(notifications),
  excludedLineItems: many(receiptLineItems, { relationName: "LineItemExcludedBy" }),
  lineItemComments: many(lineItemComments),
}));

export const districtsRelations = relations(districts, ({ many }) => ({
  schools: many(schools),
  teamRegistrationRequests: many(teamRegistrationRequests),
  scopedRoles: many(userScopeRoles),
}));

export const schoolsRelations = relations(schools, ({ one, many }) => ({
  district: one(districts, {
    fields: [schools.districtId],
    references: [districts.id],
  }),
  teams: many(teams),
  teamRegistrationRequests: many(teamRegistrationRequests),
  scopedRoles: many(userScopeRoles),
}));

export const programsRelations = relations(programs, ({ many }) => ({
  teams: many(teams),
  teamRegistrationRequests: many(teamRegistrationRequests),
  scopedRoles: many(userScopeRoles),
}));

export const userScopeRolesRelations = relations(userScopeRoles, ({ one }) => ({
  user: one(users, { fields: [userScopeRoles.userId], references: [users.id] }),
  district: one(districts, {
    fields: [userScopeRoles.districtId],
    references: [districts.id],
  }),
  school: one(schools, { fields: [userScopeRoles.schoolId], references: [schools.id] }),
  program: one(programs, {
    fields: [userScopeRoles.programId],
    references: [programs.id],
  }),
  team: one(teams, { fields: [userScopeRoles.teamId], references: [teams.id] }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  school: one(schools, { fields: [teams.schoolId], references: [schools.id] }),
  program: one(programs, { fields: [teams.programId], references: [programs.id] }),
  scopedRoles: many(userScopeRoles),
  memberships: many(teamMemberships),
  requests: many(reimbursementRequests),
  teamRegistrationSource: one(teamRegistrationRequests, {
    relationName: "ApprovedTeamSource",
    fields: [teams.id],
    references: [teamRegistrationRequests.approvedTeamId],
  }),
}));

export const teamMembershipsRelations = relations(teamMemberships, ({ one }) => ({
  user: one(users, { fields: [teamMemberships.userId], references: [users.id] }),
  team: one(teams, { fields: [teamMemberships.teamId], references: [teams.id] }),
}));

export const teamRegistrationRequestsRelations = relations(
  teamRegistrationRequests,
  ({ one }) => ({
    district: one(districts, {
      fields: [teamRegistrationRequests.districtId],
      references: [districts.id],
    }),
    school: one(schools, {
      fields: [teamRegistrationRequests.schoolId],
      references: [schools.id],
    }),
    program: one(programs, {
      fields: [teamRegistrationRequests.programId],
      references: [programs.id],
    }),
    requestedBy: one(users, {
      relationName: "TeamRequestCreatedBy",
      fields: [teamRegistrationRequests.requestedById],
      references: [users.id],
    }),
    reviewedBy: one(users, {
      relationName: "TeamRequestReviewedBy",
      fields: [teamRegistrationRequests.reviewedById],
      references: [users.id],
    }),
    approvedTeam: one(teams, {
      relationName: "ApprovedTeamSource",
      fields: [teamRegistrationRequests.approvedTeamId],
      references: [teams.id],
    }),
  }),
);

export const reimbursementRequestsRelations = relations(
  reimbursementRequests,
  ({ one, many }) => ({
    team: one(teams, {
      fields: [reimbursementRequests.teamId],
      references: [teams.id],
    }),
    createdBy: one(users, {
      relationName: "RequestCreatedBy",
      fields: [reimbursementRequests.createdById],
      references: [users.id],
    }),
    coach: one(users, {
      relationName: "RequestCoach",
      fields: [reimbursementRequests.coachId],
      references: [users.id],
    }),
    receiptFiles: many(receiptFiles),
    approvals: many(approvalActions),
    auditLogs: many(auditLogs),
    notifications: many(notifications),
  }),
);

export const receiptFilesRelations = relations(receiptFiles, ({ one }) => ({
  request: one(reimbursementRequests, {
    fields: [receiptFiles.requestId],
    references: [reimbursementRequests.id],
  }),
  extraction: one(receiptExtractions, {
    fields: [receiptFiles.id],
    references: [receiptExtractions.receiptFileId],
  }),
}));

export const receiptExtractionsRelations = relations(
  receiptExtractions,
  ({ one, many }) => ({
    receiptFile: one(receiptFiles, {
      fields: [receiptExtractions.receiptFileId],
      references: [receiptFiles.id],
    }),
    lineItems: many(receiptLineItems),
  }),
);

export const receiptLineItemsRelations = relations(
  receiptLineItems,
  ({ one, many }) => ({
    receiptExtraction: one(receiptExtractions, {
      fields: [receiptLineItems.receiptExtractionId],
      references: [receiptExtractions.id],
    }),
    excludedBy: one(users, {
      relationName: "LineItemExcludedBy",
      fields: [receiptLineItems.excludedById],
      references: [users.id],
    }),
    comments: many(lineItemComments),
  }),
);

export const lineItemCommentsRelations = relations(lineItemComments, ({ one }) => ({
  lineItem: one(receiptLineItems, {
    fields: [lineItemComments.lineItemId],
    references: [receiptLineItems.id],
  }),
  author: one(users, { fields: [lineItemComments.authorId], references: [users.id] }),
}));

export const approvalActionsRelations = relations(approvalActions, ({ one }) => ({
  request: one(reimbursementRequests, {
    fields: [approvalActions.requestId],
    references: [reimbursementRequests.id],
  }),
  actor: one(users, { fields: [approvalActions.actorId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
  request: one(reimbursementRequests, {
    fields: [auditLogs.requestId],
    references: [reimbursementRequests.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  request: one(reimbursementRequests, {
    fields: [notifications.requestId],
    references: [reimbursementRequests.id],
  }),
}));

// Convenience row types
export type UserRow = typeof users.$inferSelect;
export type DistrictRow = typeof districts.$inferSelect;
export type SchoolRow = typeof schools.$inferSelect;
export type ProgramRow = typeof programs.$inferSelect;
export type UserScopeRoleRow = typeof userScopeRoles.$inferSelect;
export type TeamRow = typeof teams.$inferSelect;
export type TeamMembershipRow = typeof teamMemberships.$inferSelect;
export type TeamRegistrationRequestRow = typeof teamRegistrationRequests.$inferSelect;
export type ReimbursementRequestRow = typeof reimbursementRequests.$inferSelect;
export type ReceiptFileRow = typeof receiptFiles.$inferSelect;
export type ReceiptExtractionRow = typeof receiptExtractions.$inferSelect;
export type ReceiptLineItemRow = typeof receiptLineItems.$inferSelect;
export type LineItemCommentRow = typeof lineItemComments.$inferSelect;
export type ApprovalActionRow = typeof approvalActions.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
