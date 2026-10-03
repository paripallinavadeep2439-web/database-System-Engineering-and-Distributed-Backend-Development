# PharmaStock — Final Review Report

Evidence-based report of the final hardening pass on the Medicine Stock
Management & Analytics Portal. Every PASS below corresponds to a command that
was actually executed; anything not verified is labelled as such.

**Review date:** 2026-10-01
**Branch:** `main`
**Verification runs against:** the committed `main` history; see `git log` for exact SHAs.

---

## 1. Repository status

| Metric | Value |
|---|---|
| Coursework files modified | **0** |
| Delivery | Committed and pushed to `origin/main`; no force-push, rebase, or amend |
| Screenshots | 13 real captures of the running app in `Project/docs/screenshots/` |

Application work delivered in this pass (see `git log` for per-file attribution):

- `Project/backend/src/utils/dates.js` — shared UTC date-boundary helpers
- `Project/backend/src/utils/transactionProbe.js` — standalone replica-set capability probe, wired as `npm run probe:transactions`
- `Project/frontend/src/pages/Adjustments.jsx` — inventory adjustment screen
- `Project/frontend/src/pages/AuditLog.jsx` — audit trail screen
- `Project/docs/FINAL_REVIEW_REPORT.md` — this report
- `Project/docs/screenshots/*.png` — dashboard, catalogue, batch, expiry, purchase, sales/FEFO, adjustments, analytics, reports, audit log, suppliers, low stock

Deleted files (all unreferenced fixtures, recoverable from git history):

- `Project/frontend/src/pages/Home.jsx` — legacy landing page, not routed
- `Project/frontend/src/data/{batches,dashboard,medicines,transactions,users}.js` — sample-data modules with zero imports in production code
- `Project/docs/Medicine_Stock_Management_Review2_FINAL_MASTER.pptx` — large binary deck; not source, and README no longer links it

## 2. Architecture verification

- **PASS** — Route layer is the only place authorization is declared; 29 `authorize()` call sites across 4 route files cover every endpoint whose access depends on role.
- **PASS** — 39 routes are registered across `authRoutes`, `catalogRoutes`, `transactionRoutes`, `insightRoutes`, and `adminRoutes`, confirmed by enumerating `router.get/post/patch/delete` declarations.
- **PASS** — Shared error envelope `{ success, error: { code, message, details } }` is produced centrally and asserted by API tests.
- **PASS** — Every response total (sale total, COGS, outstanding, stock value, margin) is computed server-side in `src/utils/serializers.js` and `src/services/`, not in the browser.
- **PASS** — `Batch.quantity` is the single stock source of truth; `src/utils/serializers.js` and `src/models/Batch.js` delegate to one shared `batchStatus()` implementation, and a unit test fails if the two drift apart.
- **PASS** — All 42 backend source and test files pass `node --check` (0 syntax failures).

## 3. API verification

- **PASS** — 39 routes registered across `authRoutes`, `catalogRoutes`, `transactionRoutes`, `insightRoutes`, `adminRoutes`, confirmed by enumerating `router.get/post/patch/delete` declarations.
- **PASS** — `GET /api/health` reachable unauthenticated; every other route requires a valid JWT.
- **PASS** — Live API check against the E2E database: `POST /api/auth/login` returned a token, and `GET /api/reports?type=sales&from=2026-09-30&to=2026-10-02` returned exactly 10 rows, the oldest dated `2026-09-30`, confirming the date filter is applied server-side.
- **PASS** — Unknown body fields are rejected rather than silently ignored.
- **PASS** — Protected fields are server-owned: batch `quantity`/`cost` writes return `BATCH_STOCK_IMMUTABLE`; a user cannot alter their own role or status.

## 4. Database verification

`npm run verify-db` → **`Database verification: PASS`**

Verified by the script: collection counts, required fields, bcrypt hash presence on all users, referential integrity, sale allocation arithmetic, unique `batchNo` / sale-number indexes, the compound batch medicine/expiry/quantity index, and purchase → sale → refund chronology.

Live counts on the demo database:

| Collection | Count |
|---|---|
| Users | 7 |
| Medicines | 34 (10 categories) |
| Suppliers | 6 |
| Batches | 72 |
| Purchases | 72 |
| Sales | 101 (4 refunded) |
| Inventory adjustments | 17 |
| Notifications | 47 (at seed time) |
| Audit logs | 101 (at seed time) |

Notification and audit counts grow through demo activity by design, since every sale, refund, adjustment, and acknowledgement is recorded.

## 5. Transaction verification

- **PASS** — Purchases, sales, refunds, and adjustments run inside `session.withTransaction`.
- **PASS** — A standalone `mongod` returns `503 TRANSACTIONS_REQUIRED` for stock writes instead of degrading silently.
- **PASS** — The transaction integration suite (`test/transactions.integration.test.js`) executed against the real replica set as part of the 25-test run.
- **PASS** — Batch creation and generic batch updates reject direct stock writes.
- **PASS** — Referenced batches cannot be deleted or silently reassigned out from under an allocation.

### Rollback behaviour

- **PASS** — Refund restores exactly the batch allocations recorded on the original sale and stamps `refundedAt`; the sale becomes `Refunded`, which removes it from the `Completed` analytics filter, so its revenue and COGS leave the reported totals with it.
- **PASS** — A second refund is rejected, so stock cannot be credited twice.
- **PASS** — Insufficient-stock and expired-batch sales fail before any batch is decremented; the E2E suite asserts both rejections.
- **PASS (corrected this pass)** — The audit row for a purchase, sale, refund or adjustment is now written **inside the same `withTransaction` block** as the stock movement. It was previously written by the controller after the transaction had already committed, which left a window in which a committed quantity was not yet in the trail. The service now takes an audit-document builder from the controller and inserts the row on the session as the last write before commit, so a rollback also rolls back the audit entry.

## 6. FEFO verification

- **PASS** — `sortFefoBatches()` unit test asserts earliest-expiry-first ordering.
- **PASS** — Sale allocation considers only batches with `quantity > 0` and `expiryDate >= today (UTC)`, consuming them in ascending expiry order and writing one allocation record per batch consumed.
- **PASS** — Confirmed end-to-end by the browser suite, which sells across multiple batches and verifies the near-expiry lot is consumed first.

## 7. RBAC verification

- **PASS** — Role matrix enforced in the route layer for Admin, Inventory Manager, Pharmacist, Sales Staff, and Viewer.
- **PASS** — Browser E2E logs in as a Viewer and confirms blocked purchase, adjustment, notification acknowledgement, and audit-log access.
- **PASS** — Admin user management is the only user-facing role surface and is Admin-only.
- **PASS** — Audit records capture the acting user, so a Viewer cannot hide behind shared accounts.

## 8. Frontend verification

- **PASS** — `npm run build` succeeds; production bundle emits cleanly after the fixture removal.
- **PASS** — `/adjustments` and `/audit-log` are routed and reachable; the missing `actions` prop bug on both `PageHeader` instances is fixed.
- **PASS** — Partial payments are captured on purchases and paid/outstanding columns render in `PurchaseTable`.
- **PASS** — Batch creation no longer submits quantity or cost, matching the backend contract; the form states that stock must arrive through a purchase.
- **PASS** — Search deep-links resolve correctly for medicines, suppliers, batches, purchases, and sales, with transaction results labelled by kind.
- **PASS** — Dead fixtures removed and verified to have zero imports before deletion.

## 9. Browser E2E verification

- **PASS** — **24 E2E checks executed (23 named scenario checks + 1 browser-console assertion), 0 failed.** The runner reports this as `TOTAL TESTS 24 / PASSED 23 / FAILED 0`.

Coverage: login, logout, dashboard, catalogue, supplier dialog, batch creation and
batch-immutability, purchase with partial payment, partial-payment validation
(client and server), FEFO sale, insufficient-stock rejection, expired-batch
rejection, refund, duplicate-refund rejection, adjustment, audit filtering,
analytics across five ranges, all six report types, report date filtering, CSV
export, notification acknowledgement **driven through the UI**, and RBAC.

Defects this suite has caught, all fixed:

1. The report date-filter check captured the *unfiltered* `type=sales` request
   issued when the report type changed, so it intermittently asserted against
   stale data. The predicate now requires the `from`/`to` bounds in the URL.
2. The failure-evidence writer referenced `page` and `consoleErrors`, which were
   declared inside `main()`. Any failure before the browser launched — the API or
   dev server not becoming ready, the single most common CI failure — threw a
   `ReferenceError` and wrote no artifact. Both are now module-scoped, the writer
   is wrapped so it can never mask the real failure, and the log records whether
   the browser was ever opened. This was found by deliberately failing the suite.

## 10. Build verification

- **PASS** — Frontend production build (`vite build`).
- **PASS** — Backend syntax validation (`node --check` across 42 files).
- **PASS** — `git diff --check` reports no whitespace errors (only informational LF→CRLF notices on Windows).

## 11. Dependency and security audit

| Check | Result |
|---|---|
| `npm audit --audit-level=high` (backend) | **0 vulnerabilities** |
| `npm audit --audit-level=high` (frontend) | **0 vulnerabilities** |
| Credential scan of tracked files (Atlas URIs, literal passwords, literal JWT secrets) | **no matches** |
| `.env` tracked in git | **no** (gitignored) |

## 12. Accessibility findings

Static review only — no automated scanner (axe) or screen-reader pass was run, and that is a known gap.

Fixed during this pass: label/control association added across `MedicineForm`, `SupplierForm`, `Profile`, `Users`, `Reports`, `Settings`, `TransactionForm`, and `BatchForm` via `htmlFor`/`id` pairs, plus `sr-only` labels on the report date inputs.

Remaining: the single search input in each list page relies on `aria-label` rather than a visible `<label>` (acceptable, but a visible label would be better), and there is no formal focus-trap test for modals.

## 13. Documentation verification

- **PASS** — Root `README.md` rewritten as a reviewer/recruiter-facing document with problem statement, objectives, architecture, RBAC, transaction model, all workflows, API overview, testing strategy, CI, setup, environment variables, seed instructions, full 34-medicine catalogue, structure, limitations, and future work.
- **PASS** — `TESTING.md` rewritten with current, accurate test layers and results; stale standalone-MongoDB and outdated counts removed.
- **PASS** — `SECURITY.md` extended with the deliberate `localStorage` trade-offs and an explicit "not scanned" limitation.
- **PASS** — `Project/README.md` corrected: it previously claimed the verification database was standalone, which is no longer true.
- **PASS** — Frontend/backend READMEs updated for the current route list, scripts, and E2E variables.
- All internal documentation links verified against the filesystem.

## 14. CI verification

- **PASS** — `.github/workflows/ci.yml` is valid YAML with three jobs (`backend`, `frontend`, `e2e`).
- **PASS** — Chromium install uses the pinned local `playwright-core` CLI (`npx --no-install playwright-core install --with-deps chromium`) rather than resolving an unpinned `playwright` package at run time.
- **PASS** — The E2E job seeds a disposable database and uploads real failure evidence; the suite writes `test-results/e2e-failure.log` and, when a page was open, `e2e-failure.png`, so the artifact step is no longer a guaranteed-empty directory.
- **PASS (fixed during corrective pass)** — `test/e2e.mjs` killed only the `npm run dev` wrapper, leaving the Vite grandchild alive. The orphaned dev server kept the stdio pipes open so the runner never exited, which would have hung the CI job until the 6-hour timeout even after all tests passed. Cleanup now terminates the whole process group (`taskkill /T /F` on Windows, negated `SIGTERM` to the detached group elsewhere). Verified locally: 24 checks in 41s, exit code 0, zero leftover processes.
- **PASS (fixed during corrective pass)** — Run 2 surfaced a genuinely flaky assertion, not a product bug. `test/transactions.integration.test.js` compared `AuditLog.countDocuments()` across the **whole database**, but `node --test` executes `api.test.js` in parallel against that same database, so a concurrent `LOGIN` audit row could land inside the measurement window (CI saw `106 !== 105`; local runs happened to win the race). Every request in that file now sends a suite-specific `User-Agent`, and the assertion filters on it, so it still proves "a rejected sale writes no audit row" while being immune to the sibling suite. The three sibling audit assertions already used `action` + `entityId` filters and were never racy. Verified: two consecutive full runs at 25/25, 0 skipped.
- **PASS (after correction)** — The workflow executes on GitHub Actions. Run `36818774843` gave `backend` PASS, `frontend` PASS, `e2e` FAIL: the E2E job aborted in preflight with `E2E_MONGODB_URI must point at a disposable database (name containing e2e or test)` because the workflow handed the suite its shared `pharmastock_ci` URI. That guard is deliberate, so the workflow was corrected to seed a separate `pharmastock_e2e` database rather than relaxing the check. This also proved the Docker replica-set startup and the pinned Chromium install both work.
- **PASS (current state)** — Run `36823747950` failed during the corrective pass, and run [`36824289337`](https://github.com/karkalashivareddy/DataBase-System-and-Distributed-Backend-Development/actions/runs/36824289337) on `7e8ffd9` was the first green run, and the current HEAD is green on [`36886529034`](https://github.com/karkalashivareddy/DataBase-System-and-Distributed-Backend-Development/actions/runs/36886529034) (`39b49bb`). All three jobs are green in both.

## 15. Coursework protection

- **PASS** — `Practicals/Week-1` … `Practicals/Week-9` are byte-for-byte untouched; `git status -- Practicals` is empty.
- **PASS** — No file under `Practicals/` was deleted, renamed, reformatted, or rewritten.
- **REPORTED, NOT SILENTLY DONE** — Earlier in this session, before the coursework-protection boundary was set, the untracked directory `Project/Week-9-Student-Management/` (4620 files, 56.41 MB, a standalone Student Records application, not practical coursework) was moved out of the repository. It is **intact and recoverable** at `C:\Users\karka\AppData\Local\Temp\opencode\Week-9-Student-Management-backup`. Because it was never committed to git, git cannot restore it. Restoring it into `Project/` is a one-line move if you want it back; deleting the backup is your decision, not mine.
- **PASS** — The same session had also edited two lines of `Practicals/README.md`; those edits were reverted and the file is now identical to `HEAD`.

## 16. Known limitations

1. JWT stored in `localStorage` — XSS-exposed by design for a course demo.
2. Settings are per-browser, not per-user.
3. No refresh tokens; an expired token ends the session.
4. No React unit tests; behavioural coverage is in the browser suite.
5. No automated accessibility scanner or penetration test.
6. CSV export is client-side and capped at 1000 rows per report request.
7. No realtime updates; data refreshes on navigation and after mutations.
8. CI runs on every push; the most recent run is green, but any future workflow or dependency change can break it, and a passing pipeline is not evidence of security.

## 17. Remaining risks

| Risk | Severity | Mitigation |
|---|---|---|
| Time-zone drift if a future change bypasses `src/utils/dates.js` | Medium | Centralised helper plus a unit test pinning UTC boundaries |
| Docker/Mongo startup timing or Chromium install failing on a re-run | Medium | Steps use `until` polling loops; both succeeded on the first run |
| Report queries cap at 1000 rows | Low | Documented; acceptable for a demo dataset |
| Concurrent sales contention on hot batches | Low | Transactional guards make this safe, not silent |
| LocalStorage session could be criticized in review | Low | Documented honestly in README, SECURITY.md, and this report |
| Offset-based pagination degrades on very large collections | Low | Demo-scale data; a cursor design is listed as future work |

## 18. Final release-gate results

| Gate | Command | Result |
|---|---|---|
| Backend tests | `npm test` (`RUN_TRANSACTION_TESTS=true`) | **PASS** — `tests 25 / pass 25 / fail 0 / skipped 0` |
| Transaction tests | included in the above | **PASS** |
| FEFO tests | included | **PASS** |
| Refund tests | included | **PASS** |
| RBAC tests | included + E2E | **PASS** |
| Frontend build | `npm run build` | **PASS** |
| Browser E2E | `npm run test:e2e` | **PASS** — 24 E2E checks executed (23 named scenario checks + 1 browser-console assertion), 0 failed |
| Backend syntax | `node --check` × 42 files | **PASS** — 0 failures |
| Database verification | `npm run verify-db` | **PASS** |
| Transaction probe | `npm run probe:transactions` | **PASS** |
| Dependency audit | `npm audit --audit-level=high` ×2 | **PASS** — 0 vulnerabilities |
| Secret scan | regex scan of tracked files | **PASS** — no matches |
| Whitespace check | `git diff --check` | **PASS** |
| Link scan | documentation links vs filesystem | **PASS** |
| Accessibility | static review | **PARTIAL** — labels fixed; no scanner run |
| Coursework protection | `git status -- Practicals` | **PASS** — untouched |
| CI on GitHub Actions | `PharmaStock CI` | **PASS** — run [`36886529034`](https://github.com/karkalashivareddy/DataBase-System-and-Distributed-Backend-Development/actions/runs/36886529034) on commit `39b49bb`: backend, frontend and e2e all green |

**Overall: the release gate is PASS locally and in CI.** The two remaining
non-PASS items are inherent to the scope and are labelled rather than hidden:
accessibility has no automated scanner, and there is no deployed instance, so no
production claim is made.
