# Abstract

The Medicine Stock Management & Analytics Portal for Pharmaceuticals is a centralized inventory system for batch-aware medicine operations. It records catalogue medicines, suppliers, manufacture and expiry dates, purchases, sales, stock adjustments, users, notifications, and audit events.

The implemented system uses a React/Vite frontend and an Express/Mongoose API backed by MongoDB. JWT authentication and bcrypt password hashing protect access. Server-side role authorization separates administrative, inventory, sales, and read-only capabilities. Batch quantities are the stock source of truth; stock totals, expiry status, low-stock alerts, inventory value, supplier metrics, and analytics are derived server-side.

Purchases, sales, refunds, and adjustments use MongoDB transactions. Sales select positive, unexpired batches using FEFO ordering, decrement each batch with a guarded update, and persist the allocation snapshot with the sale. The API refuses non-atomic stock writes when MongoDB is not running as a replica set.

The project includes a guarded development seed, database reference/index verification, API and validation tests, a production frontend build, and CI configuration. Historical coursework artifacts remain in the repository for academic preservation; they are not application configuration.

**Project Title:** Medicine Stock Management & Analytics Portal for Pharmaceuticals
**University:** KL UNIVERSITY
**Project Guide:** Dr. R. Sateesh Kumar
**Domain:** Database Systems Engineering & Distributed Backend Development
**Team:** KARKALA SHIVA REDDY (2520030105), PARIPALLI NAVADEEP (2520030196)
