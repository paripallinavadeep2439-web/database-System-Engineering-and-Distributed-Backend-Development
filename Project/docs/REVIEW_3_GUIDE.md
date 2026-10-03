# REVIEW-3 GUIDE

**Medicine Stock Management & Analytics Portal for Pharmaceuticals**
KL UNIVERSITY · Dr. R. Sateesh Kumar
KARKALA SHIVA REDDY (2520030105) · PARIPALLI NAVADEEP (2520030196)

## Introduction

PharmaStock is a React/Vite inventory portal connected to an Express/Mongoose/MongoDB API. It tracks medicines, suppliers, batches, purchases, sales, expiry risk, low stock, users, notifications, audit history, analytics, and reports.

## Database story

MongoDB stores documents in `pharma_stock_management`. The core collections are `users`, `medicines`, `suppliers`, `batches`, `purchases`, and `sales`; operational collections are `notifications`, `auditlogs`, and `inventoryadjustments`.

`ObjectId` references connect documents without duplicating names. `Batch.quantity` is the source of truth. Medicine stock and status values are derived. Sale allocation subdocuments preserve the batch quantities and unit costs used for each invoice.

Important indexes include unique user email, batch number, purchase number, and sale number; batch medicine/expiry/quantity; and transaction date/status indexes.

## Transaction story

A sale opens a MongoDB transaction, selects unexpired positive batches by earliest expiry, decrements them with guarded updates, writes the sale and allocation snapshot, creates a notification, and commits. A refund restores exactly the recorded allocations. A standalone MongoDB server cannot guarantee this behavior, so the API returns `503 TRANSACTIONS_REQUIRED` instead of using a weaker write path.

## Frontend story

The React application uses an HTTP service client rather than production fixtures. It includes dashboard, catalogue, batch, supplier, transaction, low-stock, expiry, analytics, report, user, profile, and settings screens. `AuthContext` validates the JWT against the API at startup.

## Demonstration sequence

1. Start the backend and show `GET /api/health`.
2. Run the guarded seed and `npm run verify-db`.
3. Log in through the UI; inspect the JWT-backed user session.
4. Create a medicine, supplier, and batch.
5. Record a purchase and observe the batch quantity and dashboard change.
6. On a replica-set database, record a sale and inspect its FEFO allocation.
7. Refund the sale and verify the original batches are restored.
8. Show low-stock, expiry, analytics, and reports.
9. Show an Admin-only audit view and a denied Viewer mutation.
10. Explain why stock transactions require a replica set, and the production topology that provides one.

## Likely questions

**Why MongoDB?** The domain naturally contains batch and transaction documents, ObjectId references, flexible fields, and aggregation-based inventory analytics.

**Why are references used?** Names have independent lifecycles and should not be duplicated across documents.

**How is low stock identified?** Sum positive, unexpired batch quantities by medicine and compare the result with `reorderLevel`.

**How is expiry handled?** Batch status is derived from quantity and expiry date; expired stock is excluded from available stock.

**How is authentication secured?** Passwords are bcrypt-hashed. JWTs are verified with issuer, audience, expiry, and current active-user checks. Roles are enforced by the API.

**Why can't the sale test run on a standalone server?** Transactions require a replica set; the API deliberately returns `503 TRANSACTIONS_REQUIRED` rather than risking inconsistent stock. The local verification database is a single-node replica set, so sales, refunds, and adjustments do run locally; the limitation only appears if `MONGODB_URI` is pointed at a standalone `mongod`.

## Security note

Do not display or commit real passwords, JWT secrets, database credentials, or historical credentials. The seed requires an explicit test password and reset confirmation. See `SECURITY.md` for the full checklist.
