# Database Schema

Database: `pharma_stock_management`

All documents use MongoDB `ObjectId` identifiers and Mongoose timestamps where noted. References are stored as `ObjectId`; API serializers populate display names.

## `users`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | String | Yes | Trimmed |
| `email` | String | Yes | Unique, lowercase, validated |
| `password` | String | Yes | bcrypt hash, excluded by default |
| `role` | String | Yes | `Admin`, `Inventory Manager`, `Pharmacist`, `Sales Staff`, `Viewer` |
| `phone` | String | No | Trimmed |
| `status` | String | Yes | `Active` or `Inactive` |
| `joined` | Date | Yes | Defaults to current time |
| `createdAt`, `updatedAt` | Date | Auto | Mongoose timestamps |

## `medicines`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | String | Yes | Trimmed |
| `generic` | String | Yes | Trimmed |
| `category` | String | Yes | Application category enum |
| `manufacturer` | String | Yes | Trimmed |
| `dosage` | String | No | Trimmed |
| `unitPrice` | Number | Yes | `>= 0` |
| `reorderLevel` | Number | Yes | Non-negative integer |
| `createdAt`, `updatedAt` | Date | Auto | Mongoose timestamps |

`stock` is not stored; it is aggregated from batches.

## `suppliers`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | String | Yes | Unique, trimmed |
| `contact` | String | Yes | Contact person |
| `email` | String | No | Validated email |
| `phone` | String | No | Trimmed |
| `status` | String | Yes | `Active`, `On Hold`, `Inactive` |
| `createdAt`, `updatedAt` | Date | Auto | Mongoose timestamps |

`medicinesSupplied`, `purchaseOrders`, `totalPurchased`, `outstanding`, and
`paymentCompliance` are derived metrics computed from purchase history, not stored
fields. `paymentCompliance` is the share of a supplier's purchase orders whose
status is `Paid`; the schema stores no delivery or quality data, so no such metric
is invented.

## `batches`

| Field | Type | Required | Reference/notes |
|---|---|---|---|
| `batchNo` | String | Yes | Unique, uppercase |
| `medicine` | ObjectId | Yes | `Medicine` |
| `supplier` | ObjectId | Yes | `Supplier` |
| `manufactureDate` | Date | Yes | — |
| `expiryDate` | Date | Yes | Must be after manufacture date |
| `quantity` | Number | Yes | Non-negative integer |
| `costPerUnit` | Number | Yes | `>= 0` |
| `createdAt`, `updatedAt` | Date | Auto | Mongoose timestamps |

`status` is a derived virtual: `Expired`, `Depleted`, `Near Expiry`, or `Active`.

## `purchases`

| Field | Type | Required | Reference/notes |
|---|---|---|---|
| `purchaseNo` | String | Yes | Unique |
| `supplier` | ObjectId | Yes | `Supplier` |
| `medicine` | ObjectId | Yes | `Medicine` |
| `batch` | ObjectId | Yes | `Batch` |
| `quantity` | Number | Yes | Positive integer |
| `unitCost` | Number | Yes | `>= 0` |
| `total` | Number | Yes | Server-calculated |
| `paidAmount` | Number | No | Defaults to zero; cannot exceed total |
| `date` | Date | Yes | Defaults to now |
| `status` | String | Yes | `Pending`, `Partially Paid`, `Paid` |
| `notes` | String | No | Trimmed |
| `createdBy` | ObjectId | Yes | `User` |
| `createdAt`, `updatedAt` | Date | Auto | Mongoose timestamps |

## `sales`

| Field | Type | Required | Reference/notes |
|---|---|---|---|
| `saleNo` | String | Yes | Unique |
| `medicine` | ObjectId | Yes | `Medicine` |
| `batch` | ObjectId | Yes | First allocated batch for compatibility |
| `allocations` | Array | Yes | FEFO batch, quantity, and unit-cost snapshot |
| `quantity` | Number | Yes | Positive integer |
| `unitPrice` | Number | Yes | `>= 0` |
| `total` | Number | Yes | Server-calculated |
| `customer` | String | No | Defaults to `Walk-in` |
| `date` | Date | Yes | Defaults to now |
| `status` | String | Yes | `Completed` or `Refunded` |
| `refundedAt` | Date | No | Set on refund |
| `notes` | String | No | Trimmed |
| `createdBy` | ObjectId | Yes | `User` |
| `createdAt`, `updatedAt` | Date | Auto | Mongoose timestamps |

## `inventoryadjustments`

| Field | Type | Required | Reference/notes |
|---|---|---|---|
| `medicine` | ObjectId | Yes | `Medicine` |
| `batch` | ObjectId | Yes | `Batch` |
| `quantityDelta` | Number | Yes | Signed non-zero integer |
| `quantityBefore` | Number | Yes | `>= 0`; must satisfy `before + delta === after` |
| `quantityAfter` | Number | Yes | `>= 0` |
| `reason` | String | Yes | Trimmed, max 240 |
| `note` | String | No | Trimmed, max 500 |
| `createdBy` | ObjectId | Yes | `User` |
| `createdAt` | Date | Auto | Descending index; `updatedAt` is auto |

## `notifications`

| Field | Type | Required | Reference/notes |
|---|---|---|---|
| `type` | String | Yes | `low`, `expiry`, `expired`, `system`, `sale`, `purchase` |
| `title` | String | Yes | Trimmed, max 160 |
| `message` | String | Yes | Trimmed, max 500 |
| `entityType` | String | No | Trimmed, max 40 |
| `entityId` | ObjectId | No | Deep link target |
| `read` | Boolean | Yes | Shared "reviewed by staff" flag, defaults to `false` |
| `acknowledgedBy` | ObjectId | No | `User` who reviewed it |
| `acknowledgedByEmail` | String | No | Kept so the reviewer survives a user deletion |
| `acknowledgedAt` | Date | No | Set on acknowledgement |
| `expiresAt` | Date | No | Sparse TTL index, `expireAfterSeconds: 0` |
| `createdAt`, `updatedAt` | Date | Auto | Descending `createdAt` index |

`read` is deliberately a shared operational flag rather than a per-user read
receipt, which is why the reviewer is recorded next to it.

## `auditlogs`

| Field | Type | Required | Reference/notes |
|---|---|---|---|
| `action` | String | Yes | Trimmed, max 80 |
| `entityType` | String | Yes | Trimmed, max 80 |
| `entityId` | ObjectId | No | Indexed |
| `actor` | ObjectId | No | `User` |
| `actorEmail` | String | No | Lowercased; survives actor deletion |
| `metadata` | Mixed | No | Defaults to `{}`; built from a call-site whitelist and redacted on read |
| `ipAddress` | String | No | Trimmed, max 80 |
| `userAgent` | String | No | Trimmed, max 500 |
| `createdAt` | Date | Auto | Descending index; `updatedAt` is disabled because a log row is immutable |

Audit rows for a purchase, sale, refund or adjustment are inserted on the same
session as the stock movement, so they commit and roll back with it.

## Index summary

| Collection | Secondary indexes |
|---|---|
| `users` | unique `email`; compound `{ role, status }` |
| `medicines` | `name`, `generic`, `category`, `manufacturer`; text index over `name`, `generic`, `manufacturer` |
| `suppliers` | unique `name`; `status`; text index over `name`, `contact` |
| `batches` | unique `batchNo`; `medicine`; `supplier`; `{ expiryDate, quantity }`; `{ medicine, expiryDate, quantity }` |
| `purchases` | unique `purchaseNo`; `supplier`; `medicine`; `batch`; `createdBy`; descending `date`; compound `{ supplier, date }` |
| `sales` | unique `saleNo`; `medicine`; `batch`; `createdBy`; descending `date`; compound `{ medicine, date }` |
| `inventoryadjustments` | `medicine`; `batch`; `createdBy`; descending `createdAt` |
| `notifications` | `type`; `read`; descending `createdAt`; sparse TTL on `expiresAt` |
| `auditlogs` | `action`; `entityType`; `entityId`; `actor`; descending `createdAt`; compound `{ entityType, entityId, createdAt }` |

`npm run verify-db` asserts that every collection has at least one secondary index
and specifically checks the unique `batchNo`, unique `saleNo`, and the
`{ medicine, expiryDate, quantity }` index that the FEFO query depends on.

## Seed counts

The guarded development seed produces **7 users, 34 medicines, 6 suppliers, 72
batches, 72 purchases, 101 sales (4 refunded), 17 adjustments, 47 notifications,
and 101 audit logs**. Every batch quantity is derived by replaying that ledger, not
written directly. The seed is destructive and requires both explicit confirmation
and `SEED_PASSWORD`. Notification and audit counts grow with demo activity, so only
the fresh-seed figures above are fixed.
