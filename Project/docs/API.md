# PharmaStock API

Base path: `/api`

All protected requests require:

```http
Authorization: Bearer <jwt>
Content-Type: application/json
```

Successful responses use:

```json
{"success":true,"data":{},"meta":{}}
```

`meta` is optional. Errors use:

```json
{"success":false,"error":{"code":"VALIDATION_ERROR","message":"...","details":[]}}
```

## Roles

| Role | Capabilities |
|---|---|
| Admin | Everything, including user management and the audit log |
| Inventory Manager | Purchases, sales, refunds, adjustments, batches, suppliers, notification acknowledgement |
| Pharmacist | Catalogue, batch and supplier writes, sales, notification acknowledgement |
| Sales Staff | Sales and every read endpoint |
| Viewer | Read-only |

Tables below use these access labels: **Public**, **Authenticated** (any
signed-in role), **Read roles** (all five), **Inventory roles** (Admin,
Inventory Manager, Pharmacist), **Transaction roles** (those plus Sales Staff),
and **Admin**.

## Error codes

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | A field is missing, malformed, out of range, or an undeclared field was sent |
| `INVALID_ID` | 400 | A path parameter is not a valid `ObjectId` |
| `BATCH_STOCK_IMMUTABLE` | 400 | A direct write to batch `quantity` or `costPerUnit` was attempted |
| `CORS_DENIED` | 403 | The request `Origin` is not in the allowlist |
| `UNAUTHENTICATED` | 401 | Missing, malformed, expired, or inactive-account bearer token |
| `FORBIDDEN` | 403 | Authenticated, but the role is not permitted on this route |
| `NOT_FOUND` | 404 | No such resource, or no such route |
| `DUPLICATE_RECORD` | 409 | A unique index rejected the write (duplicate email, `batchNo`, `saleNo`, …) |
| `CONFLICT` | 409 | Business-rule refusal: insufficient stock, already-refunded sale, stock would go negative |
| `DATABASE_UNAVAILABLE` | 503 | The MongoDB connection is not ready |
| `TRANSACTIONS_REQUIRED` | 503 | The deployment cannot run multi-document transactions (no replica set) |
| `PRIMARY_UNAVAILABLE` | 503 | No writable replica-set primary to run the transaction |
| `TRANSIENT_TRANSACTION_ERROR` | 503 | A retryable database error aborted the transaction; the request can be retried |
| `RATE_LIMITED` / `LOGIN_RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unhandled server fault; details are hidden when `NODE_ENV=production` |

## Common query parameters

| Parameter | Applies to | Notes |
|---|---|---|
| `page`, `limit` | list endpoints | 1-based; `limit` is clamped to the endpoint maximum (100, or 200 for audit logs) |
| `from`, `to` | `purchases`, `sales`, `notifications`, `audit-logs`, `analytics`, `reports` | Date-only `YYYY-MM-DD` values are anchored at UTC midnight; a `to` date includes the whole day (`23:59:59.999Z`) |
| `search` | most list endpoints | Case-insensitive substring; regular-expression metacharacters are escaped |
| `status` | `purchases`, `sales`, `reports` | `"All"` is treated as unset |
| `type` | `reports` | `inventory`, `sales`, `purchase`, `expiry`, `low-stock`, `supplier` |
| `q` | `search` | Free-text term |

## Authentication

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public, rate-limited | Authenticate and return `{ token, user }` |
| GET | `/auth/me` | Authenticated | Return current user |
| PATCH | `/auth/me` | Authenticated | Update name and phone only |
| POST | `/auth/change-password` | Authenticated | Change password (requires the current one) |

Login input:

```json
{"email":"user@example.in","password":"a-strong-password"}
```

The JWT carries a subject, role, email, issuer `pharmastock-api`, audience
`pharmastock-web`, and an expiry (`JWT_EXPIRES_IN`, default `8h`). Every
authenticated request reloads the user and rejects an account whose `status` is
not `Active`.

## Health

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness plus whether the deployment can actually run stock transactions (`transactions.supported`, `replicaSet`, `writablePrimary`) |

## Catalogue

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/medicines` | Read roles | List medicines with derived stock |
| POST | `/medicines` | Inventory roles | Create medicine |
| GET | `/medicines/:id` | Read roles | Get medicine |
| PATCH | `/medicines/:id` | Inventory roles | Update medicine fields |
| DELETE | `/medicines/:id` | Inventory roles | Delete only when no batches exist |
| GET | `/batches` | Read roles | List/filter batches |
| POST | `/batches` | Inventory roles | Register an empty batch (descriptive fields only) |
| GET | `/batches/:id` | Read roles | Get batch |
| PATCH | `/batches/:id` | Inventory roles | Update descriptive batch fields |
| DELETE | `/batches/:id` | Inventory roles | Delete only when quantity is 0 and no purchase, sale or allocation references it |
| GET | `/suppliers` | Read roles | List suppliers with metrics |
| POST | `/suppliers` | Inventory roles | Create supplier |
| GET | `/suppliers/:id` | Read roles | Get supplier |
| PATCH | `/suppliers/:id` | Inventory roles | Update supplier |
| DELETE | `/suppliers/:id` | Inventory roles | Delete only when no batches exist |
| GET | `/search?q=...` | Read roles | Search catalogue and transactions |

A medicine cannot be deleted while batches exist, and a batch cannot be
reassigned to another medicine once a purchase, sale allocation or adjustment
references it.

Medicine write payload:

```json
{"name":"Paracetamol 500mg","generic":"Acetaminophen","category":"Analgesics","manufacturer":"Sun Pharma","dosage":"500 mg tab","unitPrice":2.4,"reorderLevel":200}
```

Batch write payload — descriptive fields only:

```json
{"medicineId":"ObjectId","supplierId":"ObjectId","batchNo":"PCM-2401","manufactureDate":"2026-01-01","expiryDate":"2027-01-01"}
```

`quantity` and `costPerUnit` are **rejected** on both `POST /batches` and
`PATCH /batches/:id` with `400 BATCH_STOCK_IMMUTABLE`. A new batch is always
created at quantity `0` and cost `0`; stock and weighted-average cost arrive only
through a purchase.

## Transactions

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/purchases` | Read roles | List purchases |
| POST | `/purchases` | Inventory roles | Add stock to an existing batch atomically |
| GET | `/purchases/:id` | Read roles | Get purchase |
| GET | `/sales` | Read roles | List sales |
| POST | `/sales` | Transaction roles | Sell stock using FEFO atomically |
| GET | `/sales/:id` | Read roles | Get sale |
| POST | `/sales/:id/refund` | Inventory roles | Restore allocated batches atomically |
| GET | `/adjustments` | Inventory roles | List inventory adjustments |
| POST | `/adjustments` | Inventory roles | Apply a signed quantity adjustment atomically |

Purchase payload — `batchId` is required, because a purchase tops up a batch
that already exists:

```json
{"medicineId":"ObjectId","supplierId":"ObjectId","batchId":"ObjectId","quantity":50,"unitCost":1.8,"status":"Paid","paidAmount":90}
```

The batch must belong to that medicine and supplier and must not already be
expired. `total` is `quantity × unitCost`, and `costPerUnit` on the batch becomes
the weighted average across all purchases received into it. `paidAmount` must be
between `0` and `total`, and must be strictly between them when `status` is
`Partially Paid`. `outstanding` is derived as `total - paidAmount`.

Sale payload:

```json
{"medicineId":"ObjectId","quantity":2,"unitPrice":2.4,"customer":"City Meds"}
```

The server calculates the total. It rejects insufficient available stock
(`409 CONFLICT`) and refuses to allocate from expired or empty batches, so a
medicine whose entire stock has expired reports the same insufficient-stock
error. A sale spanning multiple batches records one allocation per batch, each
carrying the batch number and unit cost at sale time; `costOfGoods` and
`grossProfit` are derived from that snapshot.

Refund accepts an optional reason (recorded in the audit metadata) and refuses a
sale that is already `Refunded`.

Adjustment payload — `quantityDelta` must be a non-zero integer:

```json
{"medicineId":"ObjectId","batchId":"ObjectId","quantityDelta":-7,"reason":"Damaged in storage","note":"counted during stock take"}
```

`quantityBefore` and `quantityAfter` are recorded server-side, and a delta that
would drive the batch below zero is refused with `409 CONFLICT`.

## Insights and administration

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/dashboard` | Authenticated | KPIs, stock health, low-stock alerts, expiry timeline, 12-month trend |
| GET | `/analytics?from=&to=` | Authenticated | Revenue, COGS, gross margin, inventory value, turnover proxy, category, supplier and expiry analytics |
| GET | `/reports?type=...` | Authenticated | `inventory`, `sales`, `purchase`, `expiry`, `low-stock`, `supplier` |
| GET | `/notifications` | Authenticated | List the shared alert feed; `meta.unread` is the server-side unreviewed total |
| PATCH | `/notifications/:id/read` | Inventory roles | Acknowledge an alert, recording the reviewer |
| GET | `/users` | Admin | List users |
| POST | `/users` | Admin | Create user |
| PATCH | `/users/:id` | Admin | Update name, email, phone, role, or status |
| GET | `/audit-logs` | Admin | Read the audit trail (filterable, paginated) |
| GET | `/audit-logs/actions` | Admin | Distinct action names, for the filter dropdown |

Report `type` values are `inventory`, `sales`, `purchase`, `expiry`, `low-stock`,
and `supplier`. Sales and purchase reports accept `from`/`to` and `status`; the
other four are point-in-time snapshots. `sales` and `purchase` return at most
1000 rows per request.
