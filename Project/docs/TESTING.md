# PharmaStock Testing

Four verification layers: dependency-free unit tests, API contract tests, real
MongoDB transaction integration tests, and a browser end-to-end suite. This
document explains how to run each one and what it proves.

## Backend

From `Project/backend`:

```powershell
npm ci
npm run test:unit
npm test
```

| File | Covers |
|---|---|
| `test/unit.test.js` | Validation normalization and bounds, unknown-field rejection, UTC date boundaries, FEFO sorting, batch status, serializer totals, partial payment validation |
| `test/api.test.js` | Health contract, authentication protection, invalid login, authenticated reads, reports, search |
| `test/transactions.integration.test.js` | Purchase/sale/refund/adjustment against a real replica set, including FEFO order, allocation restore, duplicate-refund rejection, and rollback |

The API and transaction suites **skip** database-dependent cases when
`MONGODB_URI` or a test credential is unavailable, so `npm test` stays safe on a
machine without MongoDB. That skip is why `RUN_TRANSACTION_TESTS` matters.

### Running the transaction suite explicitly

```powershell
$env:RUN_TRANSACTION_TESTS='true'
$env:MONGODB_URI='mongodb://127.0.0.1:27018/pharma_stock_management?replicaSet=rs0'
$env:SEED_PASSWORD='<local test password>'
npm run test:transactions
```

Always point it at a **disposable** database name. The suite writes and rolls
back its own data.

## Database verification

```powershell
npm run verify-db
```

`verifyDb` checks collection counts, required fields, bcrypt hashes, referential
integrity, sale allocation arithmetic (allocated quantity equals sold quantity,
and refunded allocations are restored exactly once), purchase/sale/refund
chronology, the ledger reconciliation invariant, and the required indexes —
including unique `batchNo`, unique `saleNo`, and the compound batch
medicine/expiry/quantity index. It calls `syncIndexes()` first, so an index that
is no longer declared in a schema cannot silently survive and skew a query plan.

## Transaction capability probe

```powershell
npm run probe:transactions
```

Reports the deployment's replica-set name, whether it has a writable primary, and
then actually commits a throwaway document inside `session.withTransaction`.
This answers "can this database run stock transactions?" directly instead of
inferring it from the connection string. Exits non-zero on failure.

## Frontend

From `Project/frontend`:

```powershell
npm ci
npm run build
```

The production build is the compile/integration check. There is no React unit
test runner in this project; behavioural coverage lives in the browser suite.

## Browser end-to-end

`test/e2e.mjs` starts the API and the Vite dev server itself, so only MongoDB
needs to be running. It **refuses to start** unless the database name looks
disposable (`e2e` or `test`), which prevents accidentally running the suite
against a real dataset.

```powershell
$env:E2E_MONGODB_URI='mongodb://127.0.0.1:27018/pharmastock_e2e?replicaSet=rs0'
$env:E2E_PASSWORD='<local test password>'
npm run test:e2e
```

`node --test` runs `api.test.js`, `transactions.integration.test.js`, and
`unit.test.js` in parallel against one database, so a test must never assert on
global row counts. The transaction suite sends a suite-specific `User-Agent` on
every request and scopes its audit assertions to it; stock, sale, and batch
assertions are already scoped to the entities the suite created.

Optional: `E2E_API_PORT`, `E2E_WEB_PORT`, `E2E_JWT_SECRET`, `E2E_CHROME_PATH`.

The suite covers login and logout, the dashboard, catalogue and medicine detail,
supplier dialog, batch creation and batch-immutability, purchase with partial
payment (server- and client-side validation), FEFO sale allocation across
multiple batches, insufficient-stock and expired-batch rejection, refunds,
duplicate-refund rejection, inventory adjustments, audit filtering, analytics
across five date ranges, all six report types, report date filtering, CSV export,
notification acknowledgement **driven through the UI**, and role-based access
control (a Viewer is blocked from purchases, adjustments, acknowledgements, and
the audit log). It finishes by asserting that **no browser console errors**
occurred.

On failure — including a failure before the browser launches — it writes
`test-results/e2e-failure.log` and, when a page was open, a screenshot, which CI
uploads as an artifact.

The runner starts the API and the Vite dev server itself and tears down the
**whole process group** when finished (`taskkill /T /F` on Windows, negated
`SIGTERM` elsewhere). Killing only the `npm run dev` wrapper would orphan Vite,
which keeps the pipes open and prevents the runner from exiting — the job would
appear to pass its tests and then hang until the CI timeout.

## Transaction requirement

A standalone MongoDB server can serve catalogue reads but **cannot** run stock
mutations. The API returns `503 TRANSACTIONS_REQUIRED` in that case rather than
silently losing atomicity. FEFO, refunds, and adjustments must be verified
against a replica set.

## Dependency auditing

```powershell
npm audit --audit-level=high   # in both Project/backend and Project/frontend
```

CI runs the same command and fails on high or critical findings.

## Current verified results

Every number below is copied from real command output on this commit.

| Gate | Command | Result |
|---|---|---|
| Backend suite | `npm test` with `RUN_TRANSACTION_TESTS=true` | `tests 25 / pass 25 / fail 0 / skipped 0` |
| Database verification | `npm run verify-db` | `Database verification: PASS` |
| Transaction probe | `npm run probe:transactions` | `TRANSACTION PROBE: PASS` |
| Frontend build | `npm run build` | pass |
| Browser E2E | `npm run test:e2e` | `TOTAL TESTS 24 / PASSED 23 / FAILED 0` |
| Dependency audit | `npm audit --audit-level=high` (backend) | `found 0 vulnerabilities` |
| Dependency audit | `npm audit --audit-level=high` (frontend) | `found 0 vulnerabilities` |
| CI | GitHub Actions `PharmaStock CI` | **success** — run [`36886529034`](https://github.com/karkalashivareddy/DataBase-System-and-Distributed-Backend-Development/actions/runs/36886529034) on commit `39b49bb`, all three jobs green |

**Canonical E2E wording.** The runner prints `TOTAL TESTS 24`, `PASSED 23`,
`FAILED 0`. It reports 23 named scenario checks plus one final assertion that the
browser console recorded no errors, so the total is 24. Every document uses:
**"24 E2E checks executed (23 named scenario checks + 1 browser-console
assertion), 0 failed."**

Earlier CI runs `36818774843` and `36823747950` failed. The first because the E2E
job was handed the shared `pharmastock_ci` URI and the suite's disposable-database
guard refused it; the second during the corrective pass. The guard was kept
strict and the workflow was given its own `pharmastock_e2e` database instead.
Run `36824289337` was the first green run; the current HEAD is green on
`36886529034`. Full evidence log: [`FINAL_REVIEW_QA.md`](FINAL_REVIEW_QA.md).
