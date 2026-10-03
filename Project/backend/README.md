# PharmaStock Backend

Express/Mongoose API for the Medicine Stock Management & Analytics Portal.

## Stack

- Node.js 18+ (`engines: >=18`; CI pins 24.19.0)
- Express 4
- Mongoose 8 and MongoDB (replica set required)
- `jsonwebtoken` and `bcryptjs`
- Helmet, CORS, express-rate-limit
- Node built-in test runner (`node --test`)

## Setup

```powershell
Copy-Item .env.example .env
npm install
```

Set a real `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters, and `CLIENT_ORIGIN`. Never commit `.env`.

## Database

The seed is intentionally destructive and guarded:

```powershell
$env:SEED_CONFIRM='RESET'
$env:SEED_PASSWORD='use-a-local-test-password'
npm run seed -- --force
npm run verify-db
```

`SEED_PASSWORD` must be supplied explicitly; the seed does not contain a default password. Use a replica-set MongoDB deployment for purchase, sale, refund, and inventory-adjustment operations. A standalone server returns `503 TRANSACTIONS_REQUIRED` for those writes by design.

## Run

```bash
npm start
```

Health endpoint: `GET http://localhost:5000/api/health`.

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start the API |
| `npm run dev` | Start with Node watch mode |
| `npm run seed` | Guarded destructive development seed |
| `npm run verify-db` | Verify counts, references, hashes, allocations, chronology, and indexes |
| `npm run probe:transactions` | Prove the configured database can actually run multi-document transactions |
| `npm test` | Run every unit, API and transaction test; skips database-dependent cases without configuration |
| `npm run test:unit` | Run dependency-free unit tests |
| `npm run test:integration` | Run API contract tests |
| `npm run test:transactions` | Run the FEFO transaction integration suite |

Every environment variable the code reads is documented in
[`.env.example`](.env.example). The ones that matter most: `MONGODB_URI` (must be
a replica set), `JWT_SECRET` (at least 32 characters — the API refuses shorter or
placeholder values), `CLIENT_ORIGIN` (CORS allowlist), `TRUST_PROXY` (off unless
set), and the two rate-limit ceilings.

A fresh seed produces 7 users, 34 medicines, 6 suppliers, 72 batches, 72
purchases, 101 sales (4 refunded), 17 adjustments, 47 notifications and 101 audit
logs, with every batch quantity derived from the ledger.

## Transaction integration suite

The transaction suite opens real MongoDB sessions against a replica set and is
skipped unless it is explicitly enabled, so a default `npm test` stays
dependency-free:

```powershell
$env:RUN_TRANSACTION_TESTS='true'
$env:MONGODB_URI='mongodb://127.0.0.1:27018/pharma_stock_management?replicaSet=rs0'
$env:SEED_PASSWORD='use-a-local-test-password'
npm run test:transactions
```

Use a disposable database name. The suite writes and rolls back its own data.

## Structure

- `src/app.js` — middleware, health endpoint, route mounting, error handling
- `src/server.js` — process/database lifecycle
- `src/models/` — Mongoose schemas and indexes
- `src/routes/` — REST route definitions and authorization
- `src/controllers/` — HTTP handlers
- `src/services/` — dashboard, supplier, and transaction domain logic
- `src/middleware/` — JWT authentication and audit recording
- `src/seed/seed.js` — development-only seed
- `src/utils/dates.js` — shared UTC date-boundary helpers
- `src/utils/serializers.js` — response shaping and derived totals
- `src/utils/verifyDb.js` — database verification
- `test/` — Node test files

## Conventions worth knowing

- Every date filter boundary is computed in UTC through `src/utils/dates.js`,
  so results do not shift with the server's local time zone.
- `Batch.quantity` is the only stock source of truth. Batch creation and generic
  batch updates reject direct `quantity` or `cost` writes with
  `BATCH_STOCK_IMMUTABLE`; stock only moves through purchases, sales, refunds,
  and adjustments.
- A purchase always tops up an existing batch; there is no endpoint that creates a
  batch with stock already in it.
- Stock mutations and their audit rows share one MongoDB transaction, so a
  committed quantity can never be missing from the trail.
- Request bodies are normalized and validated before a controller runs, undeclared
  fields are rejected, and audit records never store passwords or tokens.

## Verified results

Run against a replica set with `RUN_TRANSACTION_TESTS=true`:

```text
npm test                  tests 25 / pass 25 / fail 0 / skipped 0
npm run verify-db         Database verification: PASS
npm run probe:transactions TRANSACTION PROBE: PASS
npm audit --audit-level=high  found 0 vulnerabilities
```

CI (`PharmaStock CI`) reproduces all of these on every push.

See `Project/docs/API.md`, `Project/docs/SECURITY.md`, and `Project/docs/DEPLOYMENT.md` for the complete contract and deployment requirements.
