# OpenNext Server Worker Size Reduction Plan

**Goal:** Get the main Cloudflare Worker (the OpenNext `.open-next/worker.js` graph) from
**~3069 KiB gzip** to **under 3000 KiB gzip** (safely below the 3072 KiB / 3 MiB limit; Cloudflare's
real check is slightly stricter than `wrangler`'s dry-run estimate). We need to cut **≈70 KiB** minimum.
**Hard constraint: ZERO feature loss** (every change here is none/low feature-loss risk).

Verified environment facts (from the live repo on 2026-05-31):
- `next@^16.1.6`, `@opennextjs/cloudflare@^1.19.11`, `pdf-lib@^1.17.1`.
- `package.json` build script is `"build": "next build"` (Next 16 defaults to **Turbopack**).
- `next build --help` confirms a real **`--webpack`** flag exists.
- `next.config.ts` already sets `serverExternalPackages: ["pdf-lib"]` — but Turbopack ignores it,
  and OpenNext re-bundles through its own esbuild pass regardless, so pdf-lib is still fully inlined
  into the main Worker.
- `open-next.config.ts` already sets `config.default.minify = true`. Cache/tag/queue overrides already
  resolve to the no-op "dummy" implementations — there is no size lever there.
- The repo already has the second-Worker pattern: `workers/receipt-consumer/index.ts` +
  `wrangler.consumer.jsonc`, deployed via `npm run deploy:consumer`. The `@/...` path alias already
  resolves inside worker builds (the consumer imports `@/db/schema`, `@/lib/...`).
- Only ONE route imports pdf-lib: `src/app/api/requests/[requestId]/pdf/route.ts` (which also imports
  `@/lib/pdf/generate-request-pdf`). `readStoredObject(url, bucketOverride?)` already accepts an R2
  bucket override (`src/lib/storage.ts` line 85-91).

---

## 1. Largest reducible Worker contributors

| Contributor | Raw in bundle | gzip cost | Reducible? | Lever |
|---|---|---|---|---|
| 6× duplicated `[root-of-the-server]__*` Turbopack chunks (next-server app-route runtime + OTel + clerk/drizzle re-embedded per route group) | ~2,269 KiB (387 KiB ×6) | **~636 KiB** (collapses to ~106 KiB if deduped) | **YES** — Turbopack artifact | Switch build to Webpack (dedupes shared chunks to 1×) |
| `pdf-lib` + `@pdf-lib/standard-fonts` + `pako` + `@pdf-lib/upng` (one route only) | ~590 KiB | **~194 KiB** (handler delta measured 2499→2305 KiB) | **YES** — single route | Move PDF generation to a separate Worker |
| `zod` v4 family — bundled **twice** (server validation copy + `@hookform/resolvers/zod` SSR copy) | ~670 KiB | ~63–130 KiB | **PARTIAL** — webpack single-instances it | Webpack dedup (no code change) |
| Clerk server SDK + transitive `jsonwebtoken` (jws/jwa) | ~247 KiB | ~50 KiB | **NO** — load-bearing for auth | Leave as-is |
| `/chunks/ssr/` SSR copies of `use client` components (react-table, radix, sonner, hookform, lucide) | ~3,235 KiB | large | **Mostly NO** — needed for first paint | Webpack vendor dedup; optional `ssr:false` on interactive-only widgets |
| `load-manifest.external.js`, next-server runtime, OTel core | ~1,550 KiB+ | framework-fixed | **NO** | — |

The first two rows are the entire game. Either one alone clears the 70 KiB gap with room to spare.

---

## 2. Recommended sequence (ordered by savings ÷ effort)

### ✅ STEP 1 — Switch the OpenNext build from Turbopack to Webpack  *(do this first; likely sufficient alone)*

**Why first:** Highest savings (~530 KiB gzip), smallest effort (one-line change), zero feature loss.
Next 16 defaults `next build` to Turbopack, which emits **six byte-identical** `[root-of-the-server]__*`
runtime chunks (~387 KiB each) — gzip's 32 KB window cannot dedupe content repeated across 387 KB
spans, so they cost ~6×. Webpack hoists that shared runtime + node_modules into a single vendor chunk.
This is the path OpenNext's own troubleshooting docs recommend for size.

**File to change:** `package.json`

```diff
   "scripts": {
-    "build": "next build",
+    "build": "next build --webpack",
```

OpenNext's `preview`/`deploy` scripts run `opennextjs-cloudflare build`, which invokes the
`package.json` `build` script — so this flag propagates automatically to every deploy.

**Estimated gzip saved:** **~530 KiB** (the 6× duplication collapses to 1×; also single-instances the
double-bundled zod).
**Feature-loss risk:** **none** — webpack and Turbopack produce functionally identical server output;
webpack is just slower to build and dedupes better. Bonus: under webpack, `serverExternalPackages`
actually starts working.

**Verify immediately after this step (may already be done):**
```bash
npm run build                          # now runs next build --webpack
npx opennextjs-cloudflare build
# Confirm Turbopack markers are gone and the duplicated runtime collapsed:
ls .open-next/server-functions/default/.next/server/chunks/ | grep -c 'turbopack' || echo "0 turbopack chunks ✓"
grep -lc 'app-route-turbo.runtime' .open-next/server-functions/default/.next/server/chunks/*root-of-the-server* 2>/dev/null
# Measure the real deploy figure:
npx wrangler deploy --dry-run --outdir /tmp/wdry
#   -> read the "Total Upload: ... / gzip: ... KiB" line. THAT is what counts against 3 MiB.
```

If `Total Upload gzip` is now under ~2950 KiB, **stop here** — Steps 2/3 are optional headroom.

---

### ⏭️ STEP 2 — Move PDF generation to a dedicated Worker  *(do only if Step 1 leaves us over ~3000 KiB, or for durable headroom)*

**Why second:** Large guaranteed removal (~194 KiB gzip; the whole pdf-lib subtree leaves the main
Worker), zero feature loss (the PDF endpoint still works, served by a second Worker with its own
independent 3 MiB budget). Slightly more effort because it adds a Worker + service binding. This is the
change most likely to *single-handedly* clear the limit if Step 1 somehow under-delivers, because the
pdf-lib delta was directly measured (handler 2499→2305 KiB gzip).

**New files:**

1. `src/lib/pdf/append-receipts.ts` — extract the existing `appendReceipts()` function verbatim out of
   `src/app/api/requests/[requestId]/pdf/route.ts` (lines 75-108) into a shared module exporting
   `appendReceipts(reportBytes, files, buffers)`. Single source of truth, imported by the new Worker only.

2. `workers/pdf/index.ts` — copy the `workers/receipt-consumer/index.ts` pattern. Exports
   `{ async fetch(req, env) }`:
   ```ts
   type Env = { RECEIPTS_BUCKET: R2Bucket; DB: D1Database };
   // parse JSON body { request: FullRequest } (ISO date strings)
   // for each request.receiptFiles: readStoredObject(f.storageUrl, env.RECEIPTS_BUCKET)
   //   -> Map<id, { buffer, mimeType }>
   // const report = await generateRequestPdf(request)
   // const merged = await appendReceipts(report, request.receiptFiles, buffers)
   // return new Response(Buffer.from(merged), { headers: { "Content-Type": "application/pdf" } })
   ```
   It reads receipt bytes itself from R2 (give it the `RECEIPTS_BUCKET` binding) rather than receiving
   base64 in the request body — avoids inflating large receipts (~10 MB → ~13 MB base64) through the
   service binding. DB binding optional (data arrives via JSON); keep it only if you prefer the Worker
   to re-query.

3. `wrangler.pdf.jsonc` — copy `wrangler.consumer.jsonc`. Set `name: "reimbursement-pdf-worker"`,
   `main: "workers/pdf/index.ts"`, `compatibility_flags: ["nodejs_compat"]` (pdf-lib + Buffer + pako
   need it), keep the `RECEIPTS_BUCKET` r2 binding, **drop** the `queues` block and `GOOGLE_AI_MODEL`.

**Files to change:**

4. `wrangler.jsonc` (main app) — add a service binding:
   ```jsonc
   "services": [
     { "binding": "PDF_WORKER", "service": "reimbursement-pdf-worker" }
   ]
   ```
   And add `PDF_WORKER: Fetcher` to `cloudflare-env.d.ts` (re-run `npm run cf-typegen`).

5. `src/app/api/requests/[requestId]/pdf/route.ts` — keep auth (`requireUser`, `getRequestAccess` +
   `canDownloadPdf`) and the `db.query.reimbursementRequests.findFirst` block **unchanged**. Then:
   - DELETE the `import { PDFDocument as PDFLibDocument } from "pdf-lib"`, the
     `import { generateRequestPdf }`, `import { readStoredObject }` imports, the receipt-reading block
     (lines 51-61), and the local `appendReceipts` function. **Nothing reachable from the main bundle
     may import pdf-lib anymore — this is what removes it.**
   - Compute `safeTitle` in the main route (keeps the filename header identical).
   - Replace generate/merge/return with a delegated fetch:
     ```ts
     const { env } = getCloudflareContext();
     const res = await env.PDF_WORKER.fetch("https://pdf-worker/generate", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ request }),   // Dates -> ISO strings automatically
     });
     if (!res.ok) return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
     return new NextResponse(res.body, {
       headers: {
         "Content-Type": "application/pdf",
         "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
       },
     });
     ```

6. `package.json` — add `"deploy:pdf": "wrangler deploy --config wrangler.pdf.jsonc"` and run it as part
   of deploy (deploy the pdf Worker before/with the main app; Cloudflare resolves service bindings lazily).

**Date correctness checkpoint:** `JSON.stringify` turns Date fields (`createdAt`, `submittedAt`,
`receiptDate`, `approvals.createdAt`, line-item dates) into ISO strings. Confirm `formatDate`
(`src/lib/format.ts`) accepts `string | Date` — if it only accepts `Date`, either revive dates in the
Worker before calling `generateRequestPdf`, or loosen `formatDate`. Numeric fields are already wrapped
in `Number(...)` at call sites, so they're safe. This is the one thing to verify for byte-identical output.

**Estimated gzip saved:** **~194 KiB** from the main Worker.
**Feature-loss risk:** **none** — identical `generate-request-pdf.ts` + `appendReceipts` logic runs,
just in a different Worker; output is byte-identical.

**Verify:**
```bash
npm run build && npx opennextjs-cloudflare build
grep -rl 'pdf-lib' .open-next/server-functions/default/ | head   # must be EMPTY
# then re-measure with wrangler deploy --dry-run as in Step 1
```
Once pdf-lib is gone, you may also remove `pdf-lib` from `serverExternalPackages` in `next.config.ts`
(harmless either way).

---

### ⏭️ STEP 3 (optional escape hatch) — Split the Clerk middleware Worker  *(only if still short after 1+2)*

`.open-next/middleware/handler.mjs` is ~635 KiB raw / ~153 KiB gzip of Clerk edge code that counts
toward the main Worker. The OpenNext multi-worker how-to
(<https://opennext.js.org/cloudflare/howtos/multi-worker>) deploys middleware as its own Worker, wired
via `WORKER_SELF_REFERENCE` / `DEFAULT_WORKER` service bindings and the Durable Objects.

**Estimated gzip saved:** ~153 KiB. **Risk:** none feature-wise, but it is the highest-effort change and
**incompatible with Cloudflare Preview URLs, Skew Protection, and the one-shot deploy command** — you
must deploy each Worker explicitly. Only reach for this if Steps 1 and 2 together still don't clear the
limit (very unlikely).

---

## 3. Cumulative savings vs the ~70 KiB needed

Starting point: **~3069 KiB gzip**. Target: **< 3000 KiB** (need to cut **≈70 KiB**).

| After step | Change | Est. gzip removed | Running total | Margin under 3000 KiB |
|---|---|---|---|---|
| Step 1 | Webpack dedup of 6× runtime chunks | ~530 KiB | **~2539 KiB** | **~461 KiB headroom** ✅ |
| Step 2 | PDF Worker split | ~194 KiB | **~2345 KiB** | ~655 KiB headroom ✅✅ |
| Step 3 | Middleware Worker split (optional) | ~153 KiB | ~2192 KiB | — |

**Step 1 alone (~530 KiB) overshoots the ~70 KiB requirement by ~7.5×.** Even taking the pessimistic end
of the Webpack estimate (~450 KiB) we land at ~2619 KiB — comfortably clear. Steps 2/3 are pure
insurance/headroom for future growth, not strictly required.

---

## 4. Things to AVOID (won't help or risk feature loss)

- **Do NOT convert pdf-lib (or anything) to `await import()` / lazy chunks for size.** The Cloudflare
  3 MiB limit counts the **sum of all modules** in the deployment. OpenNext bundles everything reachable
  into one `handler.mjs`; dynamic import does **not** change the `wrangler` gzip Total Upload figure
  (confirmed by OpenNext issue #659). Wasted effort.
- **Do NOT remove or replace `zod`.** It backs request-body validation across ~26 admin/coach/user API
  routes — removing it is a security/feature regression. Webpack single-instances it for free.
- **Do NOT slim the Clerk server SDK or drop `jsonwebtoken`.** `@clerk/nextjs/server` is already the
  minimal server-only entrypoint; `jsonwebtoken` (jws/jwa) is a transitive `@clerk/backend` dep required
  for session-token verification. Removing it breaks `auth()` / `clerkMiddleware()`. Its apparent cost is
  inflated by the Turbopack duplication, which Step 1 fixes.
- **Do NOT delete `/chunks/ssr/` client-component SSR copies.** They are needed for server-side first
  paint. (You *may* selectively `next/dynamic(..., { ssr: false })` purely-interactive widgets like data
  tables / dropdown menus that aren't in the initial HTML — `low` risk, only if you ever need more
  headroom, and verify each with a preview screenshot. Not needed for this goal.)
- **Do NOT chase `minifyIdentifiers`.** OpenNext 1.19.11 hardcodes it to `false` in `bundle-server.js`;
  there is no config flag. A post-build terser pass risks breaking Next's CommonJS dynamic-require shims.
- **Do NOT expect savings from cache/tag/queue config.** They already resolve to no-op dummies;
  `dangerous.disable*` flags only skip code that's already absent. ~0 KiB.
- **Do NOT trim unused `@pdf-lib/standard-fonts` AFM fonts as a primary lever.** It's fiddly and only
  partially helps; Step 2 removes the whole pdf-lib subtree anyway, making it moot.

---

## 5. Verification (after each step)

The single number that matters is the gzip figure from `wrangler`'s dry run (this is what Cloudflare
checks against 3 MiB):

```bash
# 1. Rebuild with the new pipeline
npm run build                          # next build --webpack (Step 1)
npx opennextjs-cloudflare build

# 2. Read the authoritative gzip size
npx wrangler deploy --dry-run --outdir /tmp/wdry 2>&1 | grep -i 'gzip'
#    -> "Total Upload: X KiB / gzip: Y KiB"   <-- Y must be < ~3000 KiB

# 3. (Step 1) Confirm the Turbopack duplication is gone
grep -l 'app-route-turbo.runtime' \
  .open-next/server-functions/default/.next/server/chunks/*root-of-the-server* 2>/dev/null | wc -l
#    -> previously 6, should now be 0 or 1

# 4. (Step 2) Confirm pdf-lib left the main Worker
grep -rl 'pdf-lib' .open-next/server-functions/default/ | wc -l   # -> 0

# 5. Smoke-test feature parity in preview (zero code-behavior change expected)
npx opennextjs-cloudflare preview
#    - load a page, sign in (Clerk), open a request
#    - download a PDF for requests with: a PDF receipt, a JPEG, a PNG, and no receipts
#      -> output byte-identical / visually identical to before; filename header preserved
#    - confirm 401/403/404 auth paths still return from the MAIN worker (they short-circuit
#      before PDF_WORKER is called)
```

A passing run = `gzip` under ~3000 KiB **and** all smoke tests green. Commit `package.json` (and, if
Step 2 was needed, the new Worker + wrangler + route changes) and deploy.
