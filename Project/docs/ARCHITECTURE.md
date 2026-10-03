# PharmaStock Architecture

## Runtime topology

```text
Browser
  -> React/Vite frontend
  -> fetch client (JWT in Authorization header)
  -> Express API (/api)
  -> validation, authorization, audit middleware
  -> controllers and domain services
  -> Mongoose models
  -> MongoDB
```

The frontend has no fixture data at all. The historical `src/data/` sample modules and the unreferenced `src/pages/Home.jsx` landing page were removed after confirming zero imports, so every value rendered by a screen comes from the API and the database.

## Backend layers

- `src/app.js` configures Helmet, CORS, JSON limits, rate limiting, health status, routes, and normalized errors.
- `src/server.js` owns process startup, database connection, and graceful shutdown.
- `src/routes/` defines URL boundaries, role checks, and request validation.
- `src/controllers/` translates HTTP requests into domain operations, and builds the
  audit document for each mutation.
- `src/services/transactionService.js` owns atomic purchase, FEFO sale, refund, and
  inventory-adjustment operations, including their audit writes.
- `src/services/dashboardService.js` calculates stock, health, trends, and analytics from source collections.
- `src/models/` defines MongoDB documents, references, indexes, and schema invariants.
- `src/middleware/auth.js` verifies JWTs against the current active user; role checks are server-side.
- `src/middleware/audit.js` captures actor, action, entity, IP and user agent into an audit document, either writing it directly or handing it to a transaction.

## Data ownership

`Batch.quantity` is the stock source of truth. Medicine stock, inventory value, low-stock alerts, expiry timelines, supplier outstanding amounts, and batch status are derived. The API never trusts a client-supplied stock field.

Purchases and sales reference `Medicine`, `Supplier`, `Batch`, and `User` documents. Sale records also store FEFO allocation snapshots so historical invoices retain the batch quantities and unit costs used at sale time.

## Transaction boundary

`recordPurchase`, `recordSale`, `refundSale`, and `adjustInventory` execute inside
`session.withTransaction`. A sale:

1. Opens a transaction and loads the medicine.
2. Selects positive, unexpired batches sorted by `expiryDate`, `createdAt`, then `_id`.
3. Decrements each batch with a guarded quantity predicate (`quantity: { $gte: take }`),
   so a concurrent writer that already took the units causes a clean `409` rather
   than a negative balance.
4. Writes the sale and its allocation snapshot.
5. Creates the transaction notification.
6. Writes the audit row **on the same session**.
7. Commits all changes together.

Step 6 is what makes the audit trail trustworthy: the audit entry and the stock
movement share one commit, so a committed quantity can never be missing from the
trail and a rolled-back movement never leaves an entry claiming it happened.
Catalog and administration writes are not transactional and audit immediately
after their own write.

A standalone MongoDB server cannot provide this guarantee. The API intentionally
returns `503 TRANSACTIONS_REQUIRED` rather than falling back to non-atomic writes,
and `npm run probe:transactions` verifies the capability directly instead of
inferring it from the connection string.

## Frontend state

`AuthContext` stores the JWT and validates it with `GET /api/auth/me` on application startup. API responses are unwrapped from `{ success, data, meta }` by `src/services/api.js`. Pages refresh server data after mutations and show API errors through the toast context.

## Failure behavior

- Invalid input returns a 4xx validation error.
- Missing or invalid JWT returns 401.
- Insufficient role returns 403.
- Duplicate unique fields return 409.
- Unknown resources return 404.
- Transaction-capable MongoDB is unavailable for a write transaction returns 503 with `TRANSACTIONS_REQUIRED`.
- Production 5xx responses hide internal details; development logs retain the server error for diagnosis.
