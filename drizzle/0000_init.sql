CREATE TABLE `ApprovalAction` (
	`id` text PRIMARY KEY NOT NULL,
	`requestId` text NOT NULL,
	`actorId` text NOT NULL,
	`action` text NOT NULL,
	`comment` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`requestId`) REFERENCES `ReimbursementRequest`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `ApprovalAction_requestId_createdAt_idx` ON `ApprovalAction` (`requestId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `AuditLog` (
	`id` text PRIMARY KEY NOT NULL,
	`actorId` text,
	`requestId` text,
	`eventType` text NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`requestId`) REFERENCES `ReimbursementRequest`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `AuditLog_requestId_createdAt_idx` ON `AuditLog` (`requestId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `AuditLog_eventType_createdAt_idx` ON `AuditLog` (`eventType`,`createdAt`);--> statement-breakpoint
CREATE TABLE `District` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `District_name_unique` ON `District` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `District_slug_unique` ON `District` (`slug`);--> statement-breakpoint
CREATE TABLE `LineItemComment` (
	`id` text PRIMARY KEY NOT NULL,
	`lineItemId` text NOT NULL,
	`authorId` text NOT NULL,
	`text` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`lineItemId`) REFERENCES `ReceiptLineItem`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `LineItemComment_lineItemId_createdAt_idx` ON `LineItemComment` (`lineItemId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `Notification` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`event` text NOT NULL,
	`message` text NOT NULL,
	`requestId` text,
	`read` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requestId`) REFERENCES `ReimbursementRequest`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `Notification_userId_read_createdAt_idx` ON `Notification` (`userId`,`read`,`createdAt`);--> statement-breakpoint
CREATE TABLE `Program` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`gradeRangeLabel` text,
	`ageRangeLabel` text,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Program_code_unique` ON `Program` (`code`);--> statement-breakpoint
CREATE TABLE `ReceiptExtraction` (
	`id` text PRIMARY KEY NOT NULL,
	`receiptFileId` text NOT NULL,
	`documentType` text DEFAULT 'OTHER' NOT NULL,
	`merchant` text,
	`receiptDate` integer,
	`subtotal` integer,
	`tax` integer,
	`total` integer,
	`currency` text DEFAULT 'USD',
	`confidence` real,
	`flags` text,
	`rawJson` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`receiptFileId`) REFERENCES `ReceiptFile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ReceiptExtraction_receiptFileId_unique` ON `ReceiptExtraction` (`receiptFileId`);--> statement-breakpoint
CREATE TABLE `ReceiptFile` (
	`id` text PRIMARY KEY NOT NULL,
	`requestId` text NOT NULL,
	`fileName` text NOT NULL,
	`mimeType` text NOT NULL,
	`storageUrl` text NOT NULL,
	`parseStatus` text DEFAULT 'QUEUED' NOT NULL,
	`uploadedAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`requestId`) REFERENCES `ReimbursementRequest`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ReceiptFile_requestId_parseStatus_idx` ON `ReceiptFile` (`requestId`,`parseStatus`);--> statement-breakpoint
CREATE TABLE `ReceiptLineItem` (
	`id` text PRIMARY KEY NOT NULL,
	`receiptExtractionId` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`description` text NOT NULL,
	`quantity` real,
	`unitPrice` integer,
	`lineTotal` integer,
	`category` text,
	`excludedAt` integer,
	`excludedById` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`receiptExtractionId`) REFERENCES `ReceiptExtraction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`excludedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ReceiptLineItem_receiptExtractionId_position_idx` ON `ReceiptLineItem` (`receiptExtractionId`,`position`);--> statement-breakpoint
CREATE TABLE `ReimbursementRequest` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`requestedTotal` integer NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`submittedAt` integer,
	`teamId` text NOT NULL,
	`createdById` text NOT NULL,
	`coachId` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`coachId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ReimbursementRequest_teamId_status_createdAt_idx` ON `ReimbursementRequest` (`teamId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ReimbursementRequest_coachId_status_idx` ON `ReimbursementRequest` (`coachId`,`status`);--> statement-breakpoint
CREATE TABLE `School` (
	`id` text PRIMARY KEY NOT NULL,
	`districtId` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`districtId`) REFERENCES `District`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `School_districtId_slug_key` ON `School` (`districtId`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `School_districtId_name_key` ON `School` (`districtId`,`name`);--> statement-breakpoint
CREATE TABLE `TeamMembership` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`teamId` text NOT NULL,
	`roleInTeam` text NOT NULL,
	`approved` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `TeamMembership_userId_teamId_roleInTeam_key` ON `TeamMembership` (`userId`,`teamId`,`roleInTeam`);--> statement-breakpoint
CREATE INDEX `TeamMembership_teamId_roleInTeam_idx` ON `TeamMembership` (`teamId`,`roleInTeam`);--> statement-breakpoint
CREATE TABLE `TeamRegistrationRequest` (
	`id` text PRIMARY KEY NOT NULL,
	`districtId` text NOT NULL,
	`schoolId` text NOT NULL,
	`programId` text NOT NULL,
	`teamName` text NOT NULL,
	`shortCode` text,
	`glAccount` text,
	`fllDivision` text,
	`notes` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`requestedById` text NOT NULL,
	`reviewedById` text,
	`reviewedAt` integer,
	`rejectionReason` text,
	`approvedTeamId` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`districtId`) REFERENCES `District`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`schoolId`) REFERENCES `School`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`approvedTeamId`) REFERENCES `Team`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `TeamRegistrationRequest_approvedTeamId_unique` ON `TeamRegistrationRequest` (`approvedTeamId`);--> statement-breakpoint
CREATE INDEX `TeamRegistrationRequest_status_createdAt_idx` ON `TeamRegistrationRequest` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `TeamRegistrationRequest_scope_status_idx` ON `TeamRegistrationRequest` (`districtId`,`schoolId`,`programId`,`status`);--> statement-breakpoint
CREATE TABLE `Team` (
	`id` text PRIMARY KEY NOT NULL,
	`schoolId` text NOT NULL,
	`programId` text NOT NULL,
	`name` text NOT NULL,
	`shortCode` text,
	`glAccount` text,
	`fllDivision` text,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`schoolId`) REFERENCES `School`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Team_schoolId_programId_name_key` ON `Team` (`schoolId`,`programId`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `Team_schoolId_shortCode_key` ON `Team` (`schoolId`,`shortCode`);--> statement-breakpoint
CREATE INDEX `Team_schoolId_programId_active_idx` ON `Team` (`schoolId`,`programId`,`active`);--> statement-breakpoint
CREATE TABLE `UserScopeRole` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`role` text NOT NULL,
	`districtId` text,
	`schoolId` text,
	`programId` text,
	`teamId` text,
	`scopeKey` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`districtId`) REFERENCES `District`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`schoolId`) REFERENCES `School`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UserScopeRole_userId_role_scopeKey_key` ON `UserScopeRole` (`userId`,`role`,`scopeKey`);--> statement-breakpoint
CREATE INDEX `UserScopeRole_userId_role_idx` ON `UserScopeRole` (`userId`,`role`);--> statement-breakpoint
CREATE INDEX `UserScopeRole_districtId_role_idx` ON `UserScopeRole` (`districtId`,`role`);--> statement-breakpoint
CREATE INDEX `UserScopeRole_schoolId_role_idx` ON `UserScopeRole` (`schoolId`,`role`);--> statement-breakpoint
CREATE INDEX `UserScopeRole_programId_role_idx` ON `UserScopeRole` (`programId`,`role`);--> statement-breakpoint
CREATE INDEX `UserScopeRole_teamId_role_idx` ON `UserScopeRole` (`teamId`,`role`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`clerkUserId` text,
	`role` text DEFAULT 'USER' NOT NULL,
	`onboardingDone` integer DEFAULT false NOT NULL,
	`mailingAddressLine1` text,
	`mailingAddressLine2` text,
	`mailingCity` text,
	`mailingState` text,
	`mailingPostalCode` text,
	`zelleType` text,
	`zelleValue` text,
	`policyAcceptedAt` integer,
	`policyVersion` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_unique` ON `User` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `User_clerkUserId_unique` ON `User` (`clerkUserId`);