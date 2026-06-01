# Reimbursement Request Manager — Deep Audit Report

## 1. Executive Summary

**Overall health: Poor-to-fair.** The application's core happy paths work, but the audit found **systemic gaps in authorization, money-correctness, and error handling** that undermine the two controls a reimbursement system exists to provide: *who is allowed to approve spending* and *what dollar amount actually gets paid*. The state machine is well-designed on paper but is not enforced under concurrency, and the trust boundary between LLM-extracted data, client input, and persisted money is porous.

The application defends well in one important sense: nearly every illegal action **fails closed** (state-machine throws, `notFound()`, 403). The damage is concentrated in (a) a handful of genuine authorization holes that fail *open*, and (b) pervasive "fails-closed-but-as-an-opaque-500" error handling that turns routine concurrency into broken UX.

### The 5 most dangerous issues

1. **[CRITICAL] Onboarding self-grant of COACH authority over any team** — any new user can make themselves an approved coach of any team and approve/reject its reimbursements. (`onboarding/complete`)
2. **[CRITICAL] PROGRAM_ADMIN cross-tenant IDOR** — a program admin scoped to one school can approve, reject, edit, and mark-paid reimbursements for the same program in *every other school/district*. (`admin-scope.ts` / `access.ts`)
3. **[HIGH] Self-service team join + IDOR on request detail/PDF** — any user can attach to an arbitrary team and read/download other families' receipts, emails, amounts, and approver comments. (`onboarding/complete`, `request-access.ts`)
4. **[HIGH] requestedTotal silently recomputed on every transition** — the dollar figure that is finally PAID can differ from what the coach/admin approved, with no snapshot and no audit of the change. (`workflow.ts`)
5. **[HIGH] No status compare-and-swap on transitions (TOCTOU)** — concurrent decisions double-process: duplicate approval/audit rows, contradictory notifications, final status inconsistent with recorded actions. (`workflow.ts`)

Stored XSS via the receipt download proxy (HIGH) is a close runner-up: an uploaded SVG/HTML file is served inline, same-origin, behind the victim's auth cookie.

### Counts by severity (post-deduplication: 87 distinct issues)

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 17 |
| Medium | 28 |
| Low | 40 |

*(The 93 verified findings collapse to 87 after merging duplicate root causes — see cross-cutting themes. Several findings were down-graded by the skeptic from their original severity; the table reflects corrected severities.)*

---

## 2. Cross-Cutting Themes

These root causes surface repeatedly across flows. **Fixing the theme fixes many findings at once.**

### A. The state-machine transition is not transactionally guarded (the single highest-leverage fix)
`transitionRequestStatus` (`workflow.ts:23-76`) reads status, asserts in-memory, then writes with `.where(eq(id))` — **no `eq(status, fromStatus)` predicate, no `updatedRows.length` check, and D1 has no interactive transactions.** This one design produces a cluster of findings:
- **Lost-update / double-process race** (cross-cutting & detail-pdf): duplicate `approvalActions`/`auditLogs`, contradictory notifications, timeline corruption in `request-progress.tsx`.
- **Opaque 500 instead of 409** on every stale/concurrent decision (coach-decision, admin-decision, submit, detail-pdf) — `assertTransition` throws an uncaught `Error`, surfaced to users as `"Decision failed."`.
- **Non-idempotent submit / double-submit** (submission).

**Fix once:** make the UPDATE conditional (`and(eq(id), eq(status, fromStatus))`), abort + return 409 when 0 rows update, and wrap all four routes' `transitionRequestStatus` calls in try/catch mapping invalid-transition → 409.

### B. `requestedTotal` is recomputed and overwritten on *every* transition
The same line (`workflow.ts:38-51`) re-derives the total from current extractions on SUBMIT, COACH_APPROVE, ADMIN_APPROVE, and MARK_PAID. This surfaces as **four separate money-integrity findings** (submission, coach-review, admin-review, cross-cutting). The figure is never pinned at decision time; the audit log records status only, never the amount. **Fix once:** snapshot the approved amount on ADMIN_APPROVED and stop recomputing on ADMIN_APPROVED/MARK_PAID/REJECT.

### C. Systemic missing-authorization / enrollment-trust gap
Membership is granted on unauthenticated client intent with `approved=true` and no eligibility check. This is the root of the two CRITICALs and the IDOR-on-detail HIGH. Self-granted COACH, self-join to any team, and the cross-tenant program-admin scope all stem from "the app trusts the requester to declare their own access."

### D. Systemic missing/swallowed error handling
- **Notifications are non-atomic with the committed transition and have no try/catch** — a notification throw 500s a committed approval; recipients are silently not notified (coach-review, admin-review, notifications, cross-cutting).
- **Client handlers branch only on `response.ok`, discard the server error body, and lack a `catch` for network drops** — silent dead-ends across team-registration-form, user-role-select, user-scope-manager, remove-member-button, team-active-toggle, submit, approval-decision.
- **Parse failures are invisible** (gemini-parsing): FAILED receipts show no error UI, no toast, no retry affordance.

### E. LLM / client input trusted as money & display text
Gemini output and client line-item edits flow into persisted totals and PDFs with no bounds: no length caps, no non-negative/finite validation, silent NaN→0 coercion, and `min={0}` inputs that destroy legitimate negative discounts.

### F. Non-atomic two-step DB operations (no `db.batch`)
Team-registration approval, receipt upload (R2-then-DB), the skip-coach double-transition, and the extraction-upsert-before-batch all commit in two un-batched steps that can strand on a mid-operation failure.

---

## 3. Findings by Flow

### 3.1 Auth & Onboarding

#### [CRITICAL] Onboarding lets any user self-grant COACH authority over any team — *security*
`src/app/api/onboarding/complete/route.ts:74-101`; `team-selector.tsx:316`; `request-access.ts:79`
The route accepts `roleIntent:'COACH'` from the client and inserts a `teamMembership` with `roleInTeam='COACH'` **and `approved=true`** with no check that the user may coach that team (only existence/active/hierarchy are validated). `getRequestAccess` derives `isCoach` from any approved COACH membership, so the self-granted coach can `coach-decision` APPROVE/REJECT any SUBMITTED request on that team.
**Impact:** Full privilege escalation past the first approval stage; an attacker can approve their own spending or sabotage a rival team. The one-time `onboardingDone` gate does not blunt it — one self-join targets any team in any district.
**Fix:** Force self-service onboarding to `PARENT_MENTOR`, or insert COACH memberships with `approved=false` requiring scoped-admin confirmation. Never set `approved=true` for COACH from client intent.

#### [HIGH] Onboarding does not verify the user may join the selected team — *security*
`onboarding/complete/route.ts:64-101`; `onboarding/page.tsx:30-66`
The page lists every active team in every district; the route auto-approves membership with no invite/domain/admin gate. Even as PARENT_MENTOR this grants `canView`/`canAccessTeam` over the team's roster and reimbursements. *(Underlying enrollment-trust gap shared with the COACH finding and the detail-page IDOR.)*
**Fix:** Require approval/invitation or an eligibility set; do not auto-approve arbitrary self-joins.

#### [HIGH] Email-based account linking does not require a verified Clerk email — *security*
`src/auth.ts:50-64`; `scripts/seed.ts:144-146,286-306`
`getOrProvisionAppUser` links/creates the app user by Clerk email via `onConflictDoUpdate(target: users.email)` with **no `verification.status` check**. Seeded privileged rows (e.g. `admin@school.org` = SUPER_ADMIN, `clerkUserId=null`) are link-eligible by email alone.
**Impact:** Role/account takeover up to SUPER_ADMIN. Exploitability is contingent on a Clerk SSO/social/enterprise connection (or misconfig) asserting an unverified email as primary — the default email/password/code flow verifies first — but the seeded-NULL row is claimed by the *first* identity to authenticate with that email regardless.
**Fix:** Gate linking on `emailAddress.verification?.status === 'verified'`.

#### [HIGH] `onConflictDoUpdate` overwrites `clerkUserId` on an already-linked row — *security*
`src/auth.ts:59-63`
The upsert sets `clerkUserId` unconditionally (no `WHERE clerkUserId IS NULL`). The most reachable variant: the first Clerk identity to sign in with a seeded admin email claims that privileged account; combined with the missing verification check, an unverified email can trigger the bind.
**Fix:** Make linking one-way and idempotent — only set `clerkUserId` when currently NULL; refuse and surface support if a verified row is already linked.

#### [MEDIUM] Team-registration approval is non-atomic — *data-integrity*
`admin/team-requests/[id]/decision/route.ts:69-92`
APPROVE inserts the team then updates the request in two un-batched, un-try/caught writes. If the second fails, an orphaned team exists and the request stays PENDING; retry violates the `Team_schoolId_programId_name_key` unique index → unhandled 500, request permanently un-approvable.
**Fix:** Wrap both in `db.batch([...])` (mirror `onboarding/complete`); catch the unique-constraint error → 409.

#### [MEDIUM] Onboarding gate enforced only on the home page — *logic-bug*
`(app)/page.tsx:148-155`; `(app)/layout.tsx`; `middleware.ts:18-22`
Middleware only does `auth.protect()`; the layout has no gate. Each page re-implements an ad-hoc check (redirect vs inline warning vs empty). No present data leak (every page scopes to the caller's memberships), but a forgotten guard on a future route is a footgun.
**Fix:** Centralize the onboarding/role gate in the `(app)` layout or a shared server guard.

#### [LOW] Team-registration form swallows server error detail — *error-handling*
`onboarding/team-registration-form.tsx:121-124` — fixed generic toast, never reads `response.json()`, unlike sibling components. **Fix:** mirror `team-selector`'s `readErrorMessage`.

#### [LOW] Client/server zod drift on empty-string optionals — *data-integrity*
`team-registration-form.tsx:34-36` vs `teams/registration-requests/route.ts:13-16` — server `.optional()` without `.or(z.literal(''))` stores `''` instead of null; can propagate (`?? undefined` doesn't coalesce `''`) to a duplicate-shortCode 500 on approval. **Fix:** server-side `.transform`/trim, normalize empty → null.

#### [LOW] Submit button never disables on empty catalog — *edge-case*
`team-registration-form.tsx:327-329` — no `disabled` guard (unlike TeamSelector's Save); empty districts/programs yields disabled dropdowns + permanently-blocked Submit with no empty-state. **Fix:** add empty-state + disable Submit when required selections unavailable.

#### [LOW] `/admin-sign-up` is a bare silent redirect — *ux*
`(auth)/admin-sign-up/page.tsx`; `middleware.ts:10` — public route redirects to `/sign-up` with no explanation, implying an admin self-reg path that doesn't exist. **Fix:** render a short explanatory page or remove the route.

---

### 3.2 Request Creation

#### [HIGH] No upload size, type, or count validation — *security*
`api/requests/[requestId]/receipts/route.ts:33-60`
Any file is buffered via `arrayBuffer()` and stored in R2 with the attacker-controlled `file.type`; only a client `accept` hint restricts type. Enables Worker OOM/502 on huge uploads, unbounded R2 fill, and — via the download proxy — inline same-origin HTML/SVG.
**Fix:** Enforce a server-side MIME+extension allowlist (pdf/jpeg/png/webp/heic), a size cap, and a max count.

#### [HIGH] Download proxy serves unvalidated Content-Type inline → stored XSS — *security*
`api/receipts/[receiptId]/download/route.ts:45-50`
`Content-Type: receipt.mimeType` + `Content-Disposition: inline` are uploader-controlled. An uploaded `text/html`/`image/svg+xml` renders inline, same-origin, behind the victim's Clerk session (`target=_blank` link) → stored XSS, exploitable by a parent against a reviewing coach/admin. *(The "filename header injection" sub-claim is not achievable — the Workers/undici Headers impl strips CR/LF.)*
**Fix:** Serve `Content-Disposition: attachment`, override Content-Type to a safe value, add `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, and RFC-5987-encode the filename. (Same root cause as the upload-validation HIGH — fix together.)

#### [HIGH] Deleting a request orphans R2 receipt objects — *data-integrity*
`api/requests/[requestId]/route.ts:113`
DELETE removes only the request row; the DB cascades `receiptFiles` but no R2 delete runs (unlike the single-receipt route at `.../receipts/[receiptId]/route.ts:46`). Every "Delete Draft" with attachments **permanently** leaks the R2 objects (the row holding `storageUrl` is gone). **Fix:** delete the R2 objects before/with the row.

#### [MEDIUM] Non-atomic upload: R2 put then DB insert, no try/catch — *data-integrity*
`receipts/route.ts:41-60` — insert failure after R2 success orphans the blob and 500s the user; the multi-file loop can partially commit. **Fix:** wrap the loop body in try/catch; `deleteStoredObject` on insert failure.

#### [MEDIUM] Coach/admin can edit/hard-delete a member's DRAFT with no audit/notification — *security*
`request-access.ts:108-109` — `canEditDraft` includes coach/admin; PATCH/DELETE/parse/receipt routes gate on it; DELETE is a hard delete with no actor recorded and no owner notification. **Fix:** record actor + notify owner, or restrict destructive draft writes to the owner.

#### [MEDIUM] Parse trigger not idempotent — *logic-bug*
`parse/route.ts:34-58`
The route selects QUEUED|FAILED receipts and enqueues **without flipping status to PROCESSING**, so concurrent/retried POSTs (driven by the `request-actions.tsx` retry loop) re-enqueue the same rows → duplicate Gemini calls and a transient total flicker. Final DB state self-heals (UNIQUE(receiptFileId) upsert + delete-then-insert). *(The recompute IS run by the consumer — the finding's "skips recompute" prose is wrong.)*
**Fix:** Atomically claim rows (`UPDATE ... SET parseStatus='PROCESSING' WHERE id IN (...) AND parseStatus IN ('QUEUED','FAILED') RETURNING`) and only enqueue claimed rows.

#### [LOW] Uploader transient hide of same-named receipts — *ux*
`receipt-uploader.tsx:57,138` — dedup by `fileName` briefly hides an already-saved receipt while a same-named file uploads; self-corrects on refresh. Deletes are id-keyed, so no wrong-file deletion. **Fix:** key on receipt id.

#### [LOW] Optimistic-delete desync + a11y + dropped validation + infinite polling — *composite*
`receipts/[receiptId]/route.ts:42-46` and components under `src/components/reimbursements/` — delete runs before recompute/R2-delete so a late throw 500s after the row is gone and the client re-shows a phantom; drop-zone missing focus ring; `request-form.tsx:59-66` drops object-form zod errors; `receipt-polling-wrapper.tsx` polls indefinitely for QUEUED/PROCESSING (not FAILED). All low-severity polish.

---

### 3.3 Gemini Parsing

#### [HIGH] Re-parse deletes & re-inserts all line items, wiping reviewer exclusions and user edits — *data-integrity*
`process-receipt.ts:103-121`; `workers/receipt-consumer/index.ts:40-49`
`processReceipt` deletes all `receiptLineItems` for the extraction and re-inserts raw Gemini output with no `excludedAt`/`excludedById` and no edit preservation. **Reachable repro:** coach excludes line items at SUBMITTED → rejects (→ DRAFT) → a QUEUED/FAILED receipt is re-parsed in DRAFT → exclusions and edits silently erased, total recomputed, no audit trail. The upsert-before-batch is also non-atomic.
**Fix:** Make `processReceipt` edit-preserving (only create line items when none exist, or merge by position; never blow away rows with `excludedAt`); guard re-parse once human edits/exclusions exist.

#### [HIGH] Parse failures are invisible to users — *error-handling*
`receipt-polling-wrapper.tsx:36-43`; `request-actions.tsx:80-99`; `extraction-review.tsx:70`
FAILED counts as "done" (spinner stops, no error); the in-button retry loop gives up with no toast; ExtractionReview renders only a bare filename + red FAILED badge with no message or retry. Non-owners get a bare filename card. **Fix:** render an error state + "Retry parsing" when `parseStatus==='FAILED'`; toast on `hasFailed`; distinguish stuck-QUEUED from FAILED.

#### [MEDIUM] Queue path: parsed DRAFT can display a stale/$0.00 total — *data-integrity*
`parse/route.ts:48-58`; `receipt-consumer/index.ts:51-58`
Producer returns 202 without recomputing; consumer recompute failure is swallowed *after the message is already ack'd*; pages seed the live total from the cached `requestedTotal` column. A freshly parsed draft shows a stale (often $0) total until the next transition/edit. **Self-heals at SUBMIT** (`workflow.ts` recomputes atomically), so it is *not* an under-reporting-at-payment bug. **Fix:** derive displayed total from line items, or make the consumer recompute guaranteed/retryable.

#### [MEDIUM] Orphaned `autofill` route has owner-only auth and ignores request state — *security*
`autofill/route.ts:29-31`
Dead code (no callers) but a live POST endpoint: authorizes on `createdById === userId` only, no state check, overwrites `requestedTotal` on a PAID/ADMIN_APPROVED request (deterministic recompute, not arbitrary value). Violates the immutability invariant on approved money. **Fix:** delete it, or route through `getRequestAccess` + gate on a writable state.

#### [MEDIUM] `min={0}` blocks/destroys negative discount line items — *logic-bug*
`editable-line-items.tsx:450,463,476,625,641,657`; `updateRow` line 162
Gemini emits discounts as negative `lineTotal`. Editing qty/price on a discount row recomputes `lineTotal = qty*price` (with null unitPrice → 0), **silently destroying the credit and inflating the reimbursable total**, auto-saved. *(`min={0}` is a soft constraint — typing a negative is still possible, so "impossible to enter" is overstated.)*
**Fix:** allow negatives for discount rows; don't auto-overwrite `lineTotal` from qty*price when the existing value is negative or qty/price absent.

#### [MEDIUM] Gemini output trusted as display text, unbounded — *security*
`gemini-normalize.ts:283-299`; `extraction-review.tsx:79,112,124`; `process-receipt.ts:77`
No length cap on merchant/description/category, no array-size cap on line items, no `rawJson` size bound. React escapes HTML (no XSS), but prompt-injected content drives extracted merchant/amounts (human reviewer is the only guard) and unbounded strings bloat D1/PDF. **Fix:** cap lengths and array size, strip control chars, bound `rawJson`.

#### [MEDIUM] No idempotency/debounce on parse & line-item saves — *edge-case*
`parse/route.ts:34-58`; `editable-line-items.tsx:119-150`
Concurrent parses race the delete+reinsert; the 600ms debounced `saveLineItem` is fire-and-forget with no `res.ok` check — a failed save (network or 4xx after state change) keeps the optimistic value and skips recompute, desyncing live total from persisted total. **Fix:** lock parsing per receipt; surface save failures (toast + revert); reconcile total from the server response.

#### [MEDIUM] Client polling hangs ~9 min; stuck PROCESSING never recovered — *ux*
`request-actions.tsx:70-99`; `receipt-polling-wrapper.tsx:21-53`; `process-receipt.ts:51`
`receipt-polling-wrapper` polls forever for QUEUED/PROCESSING; a hard consumer crash between setting PROCESSING and the catch leaves the row permanently PROCESSING (no reaper/watchdog exists). `request-actions` silently gives up after up to ~9 min (3 attempts × 3 min). Copy claims "15-60 seconds". **Fix:** add a polling deadline + a stuck-PROCESSING reaper (timestamp).

#### [LOW] No parse-completion/failure notification — *ux*
`process-receipt.ts:117-127`; `receipt-consumer/index.ts:40-58` — async parse path is the only flow with no notification; a user who navigates away never learns it finished/failed. **Fix:** emit a notification on parse failure/completion.

---

### 3.4 Submission

#### [HIGH] DRAFT with zero receipts / zero total can be submitted — *data-integrity*
`submit/route.ts:34-40`; `workflow.ts:33-43`; `aggregate.ts:16-34`
Neither the route nor `transitionRequestStatus` checks for receipts/extractions/positive total; the client merely hides the button. A direct POST submits an empty $0 request into the pipeline (and, for coach/admin submitters, auto-advances to COACH_APPROVED + emails admins). **Fix:** require `receiptFiles.length>0`, ≥1 parsed extraction, and `requestedTotal>0` server-side → 400 otherwise.

#### [MEDIUM] requestedTotal recompute at submit can silently zero out a total — *data-integrity*
`workflow.ts:35-43`; `aggregate.ts:18-33`
With ≥1 extraction whose `documentType` is outside `{RECEIPT,INVOICE,CHECK_REQUEST_FORM}` (schema default is `OTHER`) or all line items excluded, the recompute yields 0 and replaces the displayed total. The client `LiveRequestedTotal` doesn't apply the documentType filter, so UI can show $X while server stores $0. *(Part of cross-cutting theme B.)* **Fix:** only recompute when an allowed extraction with non-excluded items exists; reconcile UI with the authoritative server total.

#### [MEDIUM] Skip-coach path runs two non-atomic batches — *data-integrity*
`submit/route.ts:34-51`; `workflow.ts:45-75`
For coach/admin submitters: DRAFT→SUBMITTED (batch 1) then SUBMITTED→COACH_APPROVED (batch 2), not atomic with each other. A crash/timeout of batch 2 strands the request in SUBMITTED; retry re-enters at `nextStatus:SUBMITTED` and throws (illegal SUBMITTED→SUBMITTED), so there is **no self-service recovery**. **Fix:** collapse into one COACH_APPROVED batch, or make the route idempotent.

#### [MEDIUM] Coach notified is the stale `coachId` snapshotted at draft creation — *logic-bug*
`submit/route.ts:31-32,72-84`; `requests/route.ts:55-62`
`coachId` is captured at creation (first approved COACH). If the coach changes before submission, the notification goes to the old coach while the current coach (authorized via membership-based `isCoach`) gets none. **Fix:** resolve the current coach via `findTeamCoach(teamId)` at submit time.

#### [MEDIUM] Team with no coach → request submitted to nobody, with a success toast — *error-handling*
`submit/route.ts:42-85`
If `coachId` is null and the submitter is a plain member, neither the skip-coach branch nor the `else if(current.coachId)` branch fires: the request transitions to SUBMITTED, **zero notifications**, no admin fallback, and the user sees "Submitted to coach successfully." A silent dead-letter. **Fix:** block submission or route to scoped admins when no coach exists.

#### [MEDIUM] No server-side resubmit guard; rapid double-submit → 500 + possible duplicate rows — *edge-case*
`submit/route.ts:34-40`; `workflow.ts:23-33`
The Submit button has no in-flight disable; a second POST hits an uncaught `assertTransition` throw → opaque 500. The check-then-act read+batch can also let two interleaved requests both apply, duplicating `approvalAction`/`auditLog` rows and admin emails. *(Cross-cutting theme A.)* **Fix:** map invalid-transition → 409; disable the button while in flight; add a conditional `WHERE status = expected` guard.

#### [LOW] `submittedAt` overwritten on resubmit; never cleared on reopen — *data-integrity*
`workflow.ts:43-44` — loses the original submission time after reject/resubmit; a reopened DRAFT carries a stale `submittedAt` (leaks into PDF/inbox). Mitigated: canonical timeline lives in `approvalActions`. **Fix:** keep first `submittedAt` or add `lastSubmittedAt`; clear on reopen.

#### [LOW] Submit failure surfaces raw server text; silent on network drop — *error-handling*
`request-actions.tsx:112-127` — echoes raw 5xx HTML in a toast; no try/catch (unlike `confirmDelete`), so a fetch rejection produces no feedback. **Fix:** try/catch + fixed friendly message; never echo raw bodies. *(Cross-cutting theme D.)*

#### [LOW] Notifications skip emailless users silently; no dedup across resubmits — *logic-bug*
`notifications/sender.ts:8-30`; `submit/route.ts:61-84` — `sendNotification` resolves by email and no-ops on zero recipients; resubmit cycles insert duplicate rows. **Fix:** fall back to userId; observe zero-recipient; dedup unread per (user, request, event). *(Shared with notifications-flow dedup finding.)*

#### [LOW] Submit button lacks loading/disabled/aria-busy — *accessibility*
`request-actions.tsx:191-195` — unlike Delete/Parse; enables double-activation, no AT feedback. **Fix:** add `isSubmitting` + `loading`/`disabled`/`aria-busy`.

---

### 3.5 Coach Review

#### [HIGH] Coach can approve their own request (no segregation of duties) — *security*
`coach-decision/route.ts:33-58`; `request-access.ts:79`
No `actorId !== createdById` guard. **Two paths:** (1) a coach submitting their own request is auto-approved by `submit/route.ts:31-32` (`coachId === userId`) — segregation bypassed *by design*; (2) in a multi-coach team, a coach whose request is assigned to a *different* coach (`findTeamCoach` returns the first coach) can call `coach-decision` APPROVE on their own request.
**Fix:** add `actorId === createdById → 403` in `coach-decision` and mirror in `getRequestAccess`; reconsider the intentional coach self-approve bypass in `submit/route.ts`.

#### [MEDIUM] Illegal/stale-status transition → unhandled 500 — *logic-bug*
`coach-decision/route.ts:52-57`; `workflow.ts:39`; `status.ts:21`
No `current.status` check and no try/catch; concurrent/stale actions hit `assertTransition` → generic 500 + `"Decision failed."`, stale inbox card persists. *(Cross-cutting theme A.)* The route also admits admins yet hardcodes COACH_* targets, broadening the trigger. **Fix:** explicit `status !== 'SUBMITTED' → 409` and try/catch → 409.

#### [MEDIUM] Coach decision silently recomputes & overwrites the total at approval — *data-integrity*
`workflow.ts:41-62`; `coach/inbox/page.tsx:171`
The inbox card shows a render-time snapshot; line items are editable in SUBMITTED by coach/admin, so the coach can approve a recomputed $Y while seeing $X. The persisted figure is the *correct* live total (not corruption), but there's no confirmation/diff. *(Theme B.)* **Fix:** show the live total on the decision UI; pass an expected-total/version and reject on mismatch.

#### [MEDIUM] Decision↔notification not atomic; admin fan-out coupled to creator email — *error-handling*
`coach-decision/route.ts:59-96`; `sender.ts:14-30`
`sendNotification` after the committed transition has no try/catch → a throw 500s a committed approval. The entire notification block (incl. admin fan-out) is gated on `creator?.email && actor?.email`, so a creator with no email silently suppresses the admin "ready for review" alert. *(Theme D.)* **Fix:** wrap sends in try/catch (log, don't 500); decouple admin fan-out from creator email.

#### [LOW] TOCTOU on line-item comment status check — *edge-case*
`line-items/comments/route.ts:42-75` — status read once; a concurrent approval can let a comment land on a no-longer-commentable request. Benign. **Fix:** re-check status in the insert path / conditional guard.

#### [LOW] Brittle reject error mapping; `flatten()` 400s render `[object Object]` — *error-handling*
`approval-decision.tsx:69-92`; `coach-decision/route.ts:40-49` — object-typed zod error toasts as `[object Object]` (only reachable via direct API, since the client zod is stricter); field-error routing relies on substring matching. **Fix:** return a stable code + string; normalize before toasting; route by code.

#### [LOW] Comment length limits mismatch (client 500 / coach-decision 1000 / comment route 500) — *edge-case*
`approval-decision.tsx:27`; `coach-decision/route.ts:15`; `comments/route.ts:11`; no `maxLength`/counter. Client is stricter so no server-reject surprise. **Fix:** align limits + add `maxLength` + counter.

#### [LOW] Approve/Reject: no confirm on destructive Reject; no decision-specific aria-live — *accessibility*
`approval-decision.tsx:110-176` — *Note: several sub-claims are false* — the comment field already has `aria-describedby` wiring (`form.tsx:115-119`), errors use `role="alert"`, sonner has a built-in live region, and native buttons are keyboard-submittable. Genuine remaining gaps: no confirmation dialog before Reject (mitigated by mandatory comment) and no in-component decision-result live region. **Fix:** add a Reject confirm + decision status region.

#### [LOW] Stale inbox after a decision: refresh keeps cursor → blank deep page — *ux*
`approval-decision.tsx:91`; `coach/inbox/page.tsx:139` — empty state gated on `!cursor`; approving the last items on a cursor page renders a blank body (no controls, since both cursors compute null) with a stale "N pending" badge. **Fix:** render empty state whenever `items.length===0`, or redirect to base path.

#### [LOW] Notifications have no dedup; admin fan-out spams on every re-approval — *data-integrity*
`coach-decision/route.ts:60-92`; `sender.ts:8-30`; `schema.ts:465` — no unique on (userId, requestId, event); reject→resubmit→re-approve cycles insert fresh unread rows. **Fix:** dedup/upsert on (userId, requestId, event). *(Shared with submission + notifications dedup findings.)*

---

### 3.6 Admin Review

#### [CRITICAL] PROGRAM_ADMIN scoped only by programId can act in any school/district — *security*
`admin-scope.ts:24-49`; `access.ts:matchesScopedRoleAssignment`; `schema.ts:159-191`
A `UserScopeRole` requires only one of district/school/program/team. A PROGRAM_ADMIN row with `programId` set but `schoolId` null produces `eq(teams.programId, programId)` only — matching every team in that program across all schools/districts (teams carry independent `schoolId` and `programId`). `matchesScopedRoleAssignment` is symmetric (only a *set* mismatched column fails). So a single-school program admin can view, approve, reject, edit line items, and mark-paid reimbursements for that program in *every other school/district*.
**Impact:** Cross-tenant financial-authorization escalation (final approval + mark-paid). Listing and detail pages share the logic.
**Fix:** Require PROGRAM_ADMIN assignments to also carry school/district; treat a programId match as valid only combined with the admin's school/district; enforce at assignment-creation + DB/app validation.

#### [HIGH] Admin inbox shows Approve/Reject on SUBMITTED, but the API rejects it with a 500 — *logic-bug*
`admin/inbox/page.tsx:21,146-152`; `admin-decision/route.ts:55-71`; `status.ts`
`INBOX_STATUSES` includes SUBMITTED, and every card renders `ApprovalDecision` with `showApproveReject` defaulting true. APPROVE→ADMIN_APPROVED is illegal from SUBMITTED → uncaught `assertTransition` throw → 500 → `"Decision failed."` Both visible buttons always fail on SUBMITTED cards. Data integrity holds (the transition is correctly blocked); it's a deterministic broken UX on the most prominent admin screen. **Fix:** gate `ApprovalDecision` on `status==='COACH_APPROVED'` (or render SUBMITTED read-only); wrap `transitionRequestStatus` in try/catch → 409.

#### [MEDIUM] requestedTotal recomputed/overwritten on every admin transition (no approved snapshot) — *data-integrity*
`workflow.ts:35-55`
An admin editing line items on a COACH_APPROVED request between coach approval and mark-paid changes the PAID amount; no immutable approved-amount snapshot; audit logs status only. Float-dollar `toFixed(2)` math over a cents source-of-truth (low practical drift). *(Theme B.)* **Fix:** freeze the total at coach approval / store an explicit `approvedTotal`; do integer-cent math.

#### [MEDIUM] Mark-Paid button shown on COACH_APPROVED inbox cards always fails — *logic-bug*
`admin/inbox/page.tsx`; `approval-decision.tsx:97-105`
Inbox passes `allowMarkPaid={isCoachApproved}`, but PAID is only reachable from ADMIN_APPROVED → `assertTransition(COACH_APPROVED→PAID)` throws → 500. The detail page correctly ties it to ADMIN_APPROVED, so the two surfaces disagree. **Fix:** `allowMarkPaid={false}` in the inbox.

#### [MEDIUM] Team-registration REJECT requires no comment server-side — *data-integrity*
`admin/team-requests/[id]/decision/route.ts:9-12,55-66`; `team-request-decision.tsx:20-22`
Unlike reimbursement rejection, the schema makes comment optional with no REJECT-requires-comment guard; `rejectionReason` persists null. **Fix:** mirror the reimbursement route (400 if REJECT and no comment) + client `superRefine`.

#### [LOW] MARK_PAID notification misspells "rejectd" for the reject path — *copy*
`admin-decision/route.ts:77-80` — `decision.toLowerCase() + 'd'` yields "rejectd" for REJECT. **Fix:** explicit verb map `{ APPROVE:'approved', REJECT:'rejected' }`. *(Same typo also breaks the bell's reject-icon heuristic — see notifications.)*

#### [LOW] No disabled state after a successful decision; double-toast on rapid double-click — *ux*
`approval-decision.tsx:60-92` — buttons re-enable on fetch resolve while `router.refresh()` is in flight; second click hits an already-transitioned request → success-then-failure toast pair. Server safely rejects the duplicate. **Fix:** set a local `decided` state (like `TeamRequestDecision`); return 409.

---

### 3.7 Profiles & Admin Users

#### [HIGH] Global-role PATCH allows self-demotion / removing the last SUPER_ADMIN — *logic-bug*
`admin/users/[id]/role/route.ts:20-41`
`requireSuperAdmin()` then a blind `users.role` update — no self-demotion guard, no last-SUPER_ADMIN count. SUPER_ADMIN is the only in-app path to grant SUPER_ADMIN, so demoting the last one **irreversibly** locks the org out of global admin (recovery needs direct DB access). One-click UI repro. **Fix:** block self-demotion (compare `id` to actor); count remaining SUPER_ADMINs and reject the last demotion with 409; consider a confirm dialog.

#### [MEDIUM] Deactivating a team does not stop members creating new requests — *data-integrity*
`requests/route.ts:44-63`
The toggle UI promises "Members cannot submit new requests," but POST `/api/requests` checks only an approved membership, never `teams.active`. The picker hides inactive teams, but a cached form/draft/direct API still creates a DRAFT. **Fix:** reject with 409 when `team.active===false` in the POST handler; clarify that in-flight requests are unaffected.

#### [MEDIUM] Role change to USER doesn't revoke scoped/coach powers; no audit on role changes — *security*
`admin/users/[id]/role/route.ts:33-39`; `access.ts:buildAccessContext`
Scoped admin powers come from `userScopeRoles` and coach powers from `teamMemberships` — untouched by a global-role change, giving a false sense of "revoked." No `auditLogs` entry is written for the most security-sensitive mutation (granting/removing SUPER_ADMIN). Not an escalation (route only toggles USER/SUPER_ADMIN). **Fix:** clarify the separation in UI; write an audit entry (actor, target, before/after) on every role/scope mutation.

#### [MEDIUM] Removing a member orphans in-flight requests pointing at them — *data-integrity*
`admin/teams/[teamId]/members/[membershipId]/route.ts:62-76`
DELETE removes the membership + scope row with no check for open requests where the member is coach (`coachId`) or creator. The removed coach loses review access; the request sits in the coach queue (recoverable only by an admin, who *can* still act via `coach-decision`). PARENT_MENTOR removal orphans authored drafts. The confirm dialog warns of nothing. **Fix:** detect open requests for this member; block/warn and require reassigning the coach.

#### [MEDIUM] No last-coach invariant; sole-coach removal causes silent lost notifications — *logic-bug*
`admin/teams/[teamId]/members/[membershipId]/route.ts:24-76`
No enforcement that a team retains ≥1 COACH. With no coach, new requests get `coachId=null` and a member's submission lands in SUBMITTED with **zero notification** (`submit/route.ts:72` branch skipped). Not a hard block — admins can still advance it. *(Title's "PATCH batch" reference is inaccurate; this route is DELETE-only.)* **Fix:** reject removal of the last coach (409) or require a replacement; handle null coach in submit.

#### [MEDIUM] Profile PATCH stores Zelle email/phone with no format validation — *data-integrity*
`api/me/profile/route.ts:8-17,64-72`; `profile-form.tsx:34-58`
`zelleValue` is only `max(120)` on both sides; `type='email'/'tel'` are non-enforcing browser hints. The reimbursement payout destination can be saved as garbage. Bounded by manual payout (no automated transfer pipeline). **Fix:** `z.string().email()` for email type, phone regex for phone; mirror client-side.

#### [LOW] Zelle-less users can still reach PAID with no payout destination — *edge-case*
`api/me/profile/route.ts:8-17` — both address and Zelle fully optional; payout flow never reads them; a request can reach PAID with no recorded way to pay. **Fix:** require ≥1 payout method before submission/approval, or warn the admin at MARK_PAID.

#### [LOW] Scope POST 404-before-403 leaks ID existence; "added" toast on duplicate no-op — *security/ux*
`admin/users/[id]/scopes/route.ts:88-160`; `user-scope-manager.tsx:81-101`
Existence 404 fires before the authorization 403, an existence oracle reachable by **any authenticated user** (only `requireUser()` gates it). IDs are opaque/non-enumerable so blast radius is low. Duplicate scope returns 200 but client toasts "added." **Fix:** run authorization before existence lookups (or uniform 403/404); distinguish 200 vs 201.

#### [LOW] Scope endpoints don't bind action to target-user visibility — *security*
`admin/users/[id]/scopes/route.ts` — a SCHOOL_ADMIN can grant PROGRAM_ADMIN (within their own school) on *any* user id, including unseen ones (authorized on target school only). Contained to the admin's own authority — possibly by-design. **Fix:** verify the target user is in scope, if visibility is meant to bound it.

#### [LOW] UserRoleSelect: no `catch`, silent failure on network drop — *ux*
`user-role-select.tsx:33-55` — *not* optimistic and does *not* desync (state set only on success); the real defect is a missing `catch` (only `finally`), so a network error clears the spinner with no toast + unhandled rejection; 403 vs 500 indistinguishable. **Fix:** add `catch` toast; branch on `res.status`.

#### [LOW] Scope/member/team-active handlers swallow error detail; no network-failure toast — *error-handling*
`user-scope-manager.tsx:80-129`; `remove-member-button.tsx:31-46`; `team-active-toggle.tsx:18-37` — try/finally with no `catch`, branch only on `response.ok`, never read the error body. **Fix:** add `catch` toasts + `res.status`-specific messages. *(Theme D.)*

#### [LOW] Team edit PATCH allows whitespace-only name — *data-integrity*
`admin/teams/[teamId]/route.ts:9-14,57-66` — server `name: z.string().min(2)` without `.trim()`, so `'  '` passes via direct PATCH. *(The finding's "no shortCode uniqueness" claim is wrong — `Team_schoolId_shortCode_key` exists; the real adjacent risk is an unhandled 500 on a duplicate-shortCode PATCH.)* **Fix:** `z.string().trim().min(2)`; add try/catch → 409 on the unique violation.

---

### 3.8 Notifications

#### [HIGH] Unread badge never shows until the bell is opened — *logic-bug*
`notification-bell.tsx:97-121`
The polling effect early-returns when `!open`, and `unreadCount` (init 0) is only fetched after the popover opens. The badge is permanently hidden on load/navigation — the at-a-glance unread indicator is defeated; a coach/admin gets no signal of pending work. **Fix:** fetch on mount + a low-frequency background poll independent of `open`; keep the fast poll only while open.

#### [MEDIUM] Notification inserts non-atomic with the transition; no idempotency — *data-integrity*
`coach-decision/route.ts:52-92`; `admin-decision/route.ts:58-87`; `submit/route.ts:34-85`
The transition commits via `db.batch`, then recipient lookups + `sendNotification` run unprotected. A post-transition failure 500s a committed state change and permanently loses the notification (also possible: partial delivery then 500). *(Theme A+D.)* **Fix:** enqueue notification delivery (Cloudflare Queues, retryable) keyed by `requestId+from+to`, or fold into the transition batch; make sends non-fatal.

#### [LOW] Requester not notified when their own submission is auto-approved — *logic-bug*
`submit/route.ts:42-71` — auto-approve notifies other admins but not the creator; if submitter is the sole admin, zero notifications fire for a real state change. (The un-notified party is the actor themselves — a missing self-notification + inconsistent trail.) **Fix:** notify the creator on the auto-approve path, or document the skip.

#### [LOW] Coach approval double-notifies an admin who is also the creator — *logic-bug*
`coach-decision/route.ts:74-90` — admin list de-duped only against `actor.email`, not `creator.email`. **Fix:** also filter `creator.email` from `otherAdminEmails`.

#### [LOW] Bell icon picked by substring-matching the message, ignoring `event` — *ux*
`notification-bell.tsx:74-82` — "marked as paid", "ready for admin review", and (via the "rejectd" typo) admin-reject all fall through to the generic Bell; fragile to copy/i18n. **Fix:** switch on the typed `n.event` enum.

#### [LOW] `requestHref` can deep-link to a route the recipient can no longer view — *logic-bug*
`api/notifications/route.ts:51-64` — href derived from the current viewer + a global `isCoach` special-case; after scope loss a stale notification links to a page that `notFound()`s (fails closed). **Fix:** gate the link on `getRequestAccess.canView`; render non-clickable otherwise (UI already supports null href).

#### [LOW] Bell list capped at 20 but `unreadCount` counts all — *ux*
`api/notifications/route.ts:22,47` — a user with >20 unread sees a badge they can never clear (no "load more"/"mark all read"; older unread never surfaced). **Fix:** add pagination or "Mark all as read"; or cap displayed count to the fetched set.

#### [LOW] Bell a11y: unread count not announced; no aria-live; opacity-only read state — *accessibility*
`notification-bell.tsx:159-233` — badge text is suppressed by the trigger's `aria-label="Notifications"`, so SR users never hear the count; day groups are `<p>` not headings; read vs unread is opacity-only. **Fix:** `aria-label`/`aria-live` on the badge, semantic headings, visually-hidden "unread" text.

---

### 3.9 Detail, PDF & Shared

#### [HIGH] IDOR: any approved team member can view/PDF-download another member's request — *security*
`request-access.ts:107,116`; `user/requests/[requestId]/page.tsx:72`; `pdf/route.ts:27`
`canView`/`canDownloadPdf` = `isOwner || isReimbursementAdmin || isTeamMember`, where `isTeamMember` is true for *any* approved member. A parent can open and PDF-download another family's request — submitter email, line items, approver emails/comments, and raw receipt images. *(Combined with the self-join HIGH, the trust boundary is wide open.)* **Fix:** for non-privileged members, gate on `isOwner || isReimbursementAdmin || isCoach`; drop the bare `isTeamMember` grant unless team-wide visibility is an explicit, documented product decision.

#### [HIGH] TOCTOU: status UPDATE has no `from`-status guard → double-approval/double-side-effects — *data-integrity*
`workflow.ts:23-74` *(Cross-cutting theme A; merged with the cross-cutting "concurrent decisions race" finding.)*
Read-then-batch with `.where(eq(id))` only; concurrent reviewers/double-clicks/retries both pass `assertTransition` and both commit, inserting duplicate `approvalActions`/`auditLogs` and corrupting `request-progress`'s positional `decisions[0]/[1]` cycle logic. *("Double payment" is overstated — PAID is just a status flag, no funds move.)* **Fix:** `and(eq(id), eq(status, fromStatus))` + `.returning()` length check → abort + 409 on 0 rows.

#### [MEDIUM] Stale decision POST → unhandled 500 instead of 409 — *error-handling*
`coach-decision/route.ts:52`; `admin-decision/route.ts:58`; `workflow.ts:33` — *(Theme A; merges with the coach-review and submission "illegal transition → 500" findings.)* No try/catch around `transitionRequestStatus`; a stale-tab decision surfaces as `"Decision failed."` with no refresh guidance. **Fix:** catch → 409 with an "already reviewed" message.

#### [MEDIUM] Line-item soft-vs-hard delete branches on status, so a coach hard-deletes an owner's DRAFT item — *logic-bug*
`line-items/route.ts:200-216`
`isReviewerExclusion = (isCoach||isReimbursementAdmin) && status !== 'DRAFT'`. A same-team coach editing a DRAFT falls to the ELSE branch and **hard-deletes** the owner's line item (no `excludedAt`/`excludedById` audit), then `recalculateRequestTotal` masks it. Fires deterministically on a current DRAFT (not a race). **Fix:** branch on `!isOwner` (non-owners always soft-exclude); reserve hard delete for the owner's own DRAFT.

#### [MEDIUM] Line-item edits accept unvalidated/negative/arbitrary values — *data-integrity*
`line-items/route.ts:37-45,100-107`; `aggregate.ts:30`
`quantity/unitPrice/lineTotal` are bare `z.number()` (no nonnegative/finite/precision), `description/category` unbounded. An authorized editor can PUT `lineTotal:-500` and drive `requestedTotal` negative, surfacing on the PDF/summary. *(zod rejects literal NaN/Infinity, and `Math.round(*100)` rounds sub-cents — those two sub-claims are overstated.)* **Fix:** `.nonnegative().finite()` on prices, int≥0 quantity, `.max(N)` strings; optionally re-derive `lineTotal` server-side.

#### [MEDIUM] PDF route returns 200 while silently omitting unreadable/unsupported receipts — *error-handling*
`pdf/route.ts:51-64,86-104`
R2 read failures, embed failures, and unsupported MIME types (webp/heic — no else branch) are swallowed; the approver downloads "the evidence" with receipts missing and no signal. **Fix:** render a placeholder page per failed/unsupported receipt and surface an omitted-count in the report body.

#### [LOW] Admin can't act on SUBMITTED from `/admin/requests/[id]` (404) but can from `/user/requests/[id]` — *logic-bug*
`admin/requests/[requestId]/page.tsx:27-33`; `user/requests/[requestId]/page.tsx:39-51` — UX/policy inconsistency only (the coach-decision API independently authorizes the admin, so it's not an auth gap). **Fix:** one policy on both pages.

#### [LOW] Download-PDF link opens a new tab showing a raw JSON error on failure — *ux*
`download-pdf-link.tsx:8-15`; `pdf/route.ts:19,25,28` — plain anchor `target=_blank`; on 401/403/404 the browser renders `{"error":"..."}`; no loading state for multi-second generation. Authz itself is correct. **Fix:** fetch via JS with a loading state; toast on non-OK; or redirect to a friendly page for browser GETs.

#### [LOW] StatusBadge renders unknown status as a generic badge; COACH_APPROVED & ADMIN_APPROVED color-identical — *ux*
`status-badge.tsx:162-177` — untyped `status:string`, silent secondary fallback; two approval states differ only by text. Statuses are enum-controlled, so low risk. **Fix:** type as `RequestStatus`; give the two approvals distinct visual treatment.

---

### 3.10 Cross-Cutting System (remaining items not folded into themes above)

#### [MEDIUM] Receipt extraction upsert runs outside `db.batch()` — *data-integrity*
`process-receipt.ts:90-122`
The extraction header upsert is a separate statement before the atomic delete/insert+status batch (it needs the id). On a re-parse where the batch fails after the upsert, the header carries new values while line items roll back to stale rows; `recomputeRequestTotal` has no `parseStatus===DONE` filter and runs unconditionally, summing stale items into `requestedTotal`. *(Line items are left stale, not deleted — D1 batches are atomic; `parseStatus` ends FAILED via the catch, not stuck.)* **Fix:** fold the upsert into the batch with an app-side id, or guard recompute behind `parseStatus===DONE`.

#### [MEDIUM] No rate limiting; `/parse` re-parses FAILED receipts on every call — *security*
`parse/route.ts:60-78`; `middleware.ts:18-23`
Middleware only does `auth.protect()`; no limiter anywhere. Each POST re-selects FAILED receipts and re-dispatches them (synchronous unbounded Gemini in the no-queue/local fallback; via the queue in prod). Authenticated, self-scoped cost amplification (gated to a DRAFT owner/coach/admin). **Fix:** per-user + per-request rate limit; cap inline concurrency; reject re-parse while PROCESSING.

#### [MEDIUM] `logAuditEvent` is dead code; audit log covers only status transitions — *data-integrity*
`audit/log.ts:4-21` (zero callers); `workflow.ts:62-77` (only writer)
No forensic record for line-item edits/exclusions, receipt parse/total changes, scope-role changes, or the `clerkUserId` relink in `getOrProvisionAppUser`. **Fix:** wire `logAuditEvent` into those mutations (especially the identity relink) or remove it.

#### [LOW] `error.tsx`/`global-error.tsx` render raw `error.message` — *error-handling*
`error.tsx:33`; `global-error.tsx:37` — *(line cites in the finding are off by 7.)* In practice only `USER_NOT_FOUND` (an RSC throw) can reach the boundary, and only in dev (Next digests RSC messages in prod); the API-thrown strings (FORBIDDEN, transition errors) are caught and returned as JSON. Defensive fix worth doing: render a generic string + `error.digest` only.

#### [LOW] `getCachedAccessContext` in-flight map never positively caches — *code-quality/perf*
`access.ts:90,268-280` — the `.finally()` deletes the entry, so only truly-concurrent loads collapse; every request still does 3 DB round-trips; no invalidation hook. Keyed by userId, so no cross-user leak. **Fix:** remove the map, or back access context with `revalidateTag` so role changes invalidate it.

#### [LOW] `money` type: no non-negative/finite guard; silent NaN→0; decentralized cents conversion — *data-integrity*
`schema.ts:18-21`; `aggregate.ts:25,30`; `workflow.ts:51`
No floor at 0 (a negative AI lineTotal reduces the payable total), non-finite line totals silently coerce to 0, no `requestedTotal >= 0` assertion. *(The double-rounding/sub-cent fragility sub-claim is overstated — `toFixed(2)` before `Math.round(*100)` is deterministic.)* **Fix:** clamp/validate at write time; treat non-finite as a parse failure; centralize cents conversion.

---

## 4. Prioritized Fix Order (Punch List)

Ordered for **maximum risk reduction per unit of work**. Items 1–3 are the bleeding wounds; 4–7 are the high-leverage systemic themes that each retire many findings.

1. **Close the two CRITICAL authorization holes.**
   a. Onboarding: never set `approved=true` for client-declared COACH; force self-service to PARENT_MENTOR with admin promotion (`onboarding/complete`).
   b. Require PROGRAM_ADMIN scope rows to carry school/district and make program matching school/district-bounded (`admin-scope.ts`, `access.ts`); validate at assignment-creation.

2. **Stop cross-tenant/cross-family data exposure (HIGH).**
   a. Require approval/invitation for team join (kill arbitrary self-join).
   b. Drop the bare `isTeamMember` grant from `canView`/`canDownloadPdf` — restrict non-privileged read to owner/admin/coach.

3. **Fix the receipt upload/download stored-XSS + DoS surface (HIGH).** Server-side MIME+extension allowlist + size/count caps on upload; serve downloads as `attachment` with safe Content-Type, `nosniff`, and a restrictive CSP.

4. **Harden the state machine — one fix retires a cluster (HIGH + several MEDIUM/LOW).** Add `and(eq(id), eq(status, fromStatus))` + `.returning()` length check to `transitionRequestStatus`; wrap all four routes in try/catch → 409. Eliminates the TOCTOU double-process, the duplicate audit/approval rows, and the opaque-500-on-stale-decision across coach/admin/submit/detail flows.

5. **Pin the money figure (HIGH + 3 MEDIUM).** Stop recomputing `requestedTotal` on ADMIN_APPROVED/MARK_PAID/REJECT; snapshot the approved amount; add a content gate so empty/$0 DRAFTs cannot be submitted; add non-negative/finite validation to line-item input and `aggregate`.

6. **Lock down identity provisioning (HIGH).** Gate email-based linking on `verification.status === 'verified'`; only set `clerkUserId` when currently NULL; refuse rebinds. Audit the relink.

7. **Make side-effects reliable (HIGH badge bug + MEDIUM notification atomicity + theme-D error handling).** Fix the notification bell to fetch unread on mount; move notification delivery onto Cloudflare Queues (retryable, idempotent, decoupled from the committed transition); standardize client error handling (add `catch`, read the server error body) across the ~8 affected handlers.

8. **Plug the lifecycle/data-integrity gaps (MEDIUM cluster).** Block requests on inactive teams; enforce a last-coach invariant + notify on coachless submit; preserve reviewer exclusions/edits across re-parse; batch the team-registration approval; fold the extraction upsert into its batch; delete R2 objects on request delete; require a server-side reject comment on team registration.

9. **Lower-risk hardening.** Add rate limiting; wire/remove `logAuditEvent`; the global-role self-demotion/last-SUPER_ADMIN guard (HIGH but self-inflicted + DB-recoverable, so sequenced here); Zelle/payout validation; the autofill dead-route removal.

10. **UX, copy, and a11y polish (the LOW tail).** Notification dedup + pagination + a11y; the "rejectd" typo and bell icon heuristic; loading/disabled/aria-busy on Submit and decision buttons; PDF placeholder pages; status-badge typing and color distinction; empty-state and stale-inbox refresh fixes.