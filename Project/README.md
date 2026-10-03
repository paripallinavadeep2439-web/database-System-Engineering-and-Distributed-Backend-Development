# Medicine Stock Management & Analytics Portal for Pharmaceuticals

## Project Review – 2/3

**KL UNIVERSITY**
**Project Guide:** Dr. R. Sateesh Kumar

| Name | Roll No. |
|---|---|
| KARKALA SHIVA REDDY | 2520030105 |
| PARIPALLI NAVADEEP | 2520030196 |

## Overview

PharmaStock is a batch-aware pharmaceutical inventory portal. It tracks catalogue medicines, suppliers, stock lots, purchases, sales, expiry risk, low-stock conditions, users, notifications, audit history, analytics, and reports.

## Current implementation

The project is now a full-stack implementation:

- React 18 and Vite frontend with responsive routed screens.
- Express 4 API with centralized validation, error normalization, Helmet, CORS allowlisting, and rate limits.
- Mongoose models for users, medicines, suppliers, batches, purchases, sales, notifications, audit logs, and inventory adjustments.
- JWT authentication with bcrypt password hashing and server-side roles.
- MongoDB transaction services for stock-changing operations.
- FEFO sale allocation, refunds, low-stock and expiry calculations, reports, search, and analytics.
- Guarded development seed, database verification, Node tests, and CI.

Stock-changing endpoints require a MongoDB replica set because purchases, sales, refunds, and adjustments run inside transactions. A standalone deployment can still serve catalogue reads, and returns `503 TRANSACTIONS_REQUIRED` for any stock mutation instead of silently writing inconsistent data.

## Data flow

```text
User action
  -> React component
  -> src/services/api.js
  -> Express route and authorization middleware
  -> controller/domain service
  -> Mongoose model
  -> MongoDB
  -> normalized JSON response
  -> React state refresh
```

`Batch.quantity` is the stock source of truth. Medicine stock, batch status, inventory value, supplier metrics, and dashboard values are derived server-side.

## Run

See the root [`README.md`](../README.md) for local setup. API details are in [`docs/API.md`](docs/API.md), and deployment requirements are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Database design](docs/DATABASE_DESIGN.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Database setup](docs/DATABASE_SETUP.md)
- [Abstract](docs/ABSTRACT.md)
- [Review-3 guide](docs/REVIEW_3_GUIDE.md)
- [Final review report](docs/FINAL_REVIEW_REPORT.md)
- [Final QA evidence](docs/FINAL_REVIEW_QA.md)
- [Final demo script](docs/FINAL_DEMO_SCRIPT.md)
- [Application screenshots](docs/screenshots/)
