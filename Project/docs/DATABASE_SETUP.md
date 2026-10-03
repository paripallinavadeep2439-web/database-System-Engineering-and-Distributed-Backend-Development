# Database Setup

A **replica set is required**. Purchases, sales, refunds and adjustments run inside
MongoDB multi-document transactions, which a standalone `mongod` cannot execute —
the API answers `503 TRANSACTIONS_REQUIRED` rather than writing inconsistent stock.
A standalone server is fine for inspecting data, but not for exercising the
application's core behaviour.

## Local setup

### 1. Start a single-node replica set

With Docker:

```powershell
docker run --name pharmastock-mongo -d -p 27017:27017 mongo:7.0 mongod --replSet rs0 --bind_ip_all
docker exec pharmastock-mongo mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
# Wait for a writable primary before continuing.
docker exec pharmastock-mongo mongosh --quiet --eval "db.hello().isWritablePrimary"
```

Using a locally installed `mongod` instead:

```powershell
mongod --replSet rs0 --dbpath C:\data\pharmastock --bind_ip 127.0.0.1 --port 27018
mongosh --port 27018 --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27018'}]})"
```

### 2. Configure the backend

```powershell
Copy-Item Project/backend/.env.example Project/backend/.env
cd Project/backend
npm ci
```

Set at minimum:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27018/pharma_stock_management?replicaSet=rs0
JWT_SECRET=<a random string of at least 32 characters>
CLIENT_ORIGIN=http://localhost:5173
```

Every supported variable is annotated in [`.env.example`](../backend/.env.example).

## Seed safely

The seed clears the PharmaStock collections before inserting demo data. Use it
only with a disposable development database. It refuses to run without an explicit
confirmation **and** an explicit password; there is no default password anywhere in
the repository.

```powershell
$env:SEED_CONFIRM='RESET'
$env:SEED_PASSWORD='use-a-local-test-password'
npm run seed -- --force
```

A fresh seed produces exactly **7 users, 34 medicines, 6 suppliers, 72 batches, 72
purchases, 101 sales (4 refunded), 17 adjustments, 47 notifications, and 101 audit
logs.** Every batch is created empty and its quantity is derived by replaying the
purchase/sale/refund/adjustment ledger, so batches cannot hold stock that no
transaction produced. Sale records carry FEFO allocation snapshots, and purchase
paid amounts are consistent with their status.

## Verify

```powershell
npm run verify-db
```

Checks collection counts against minimums, required fields, bcrypt hashes,
referential integrity, sale allocation arithmetic, purchase/sale/refund
chronology, the batch ledger reconciliation invariant, and the required indexes —
including unique `batchNo`, unique `saleNo`, and the
`{ medicine, expiryDate, quantity }` compound index the FEFO query depends on.

To confirm the deployment can actually run transactions:

```powershell
npm run probe:transactions
```

This reports the replica-set name and writable-primary status, then commits a
throwaway document inside a real `session.withTransaction`.

## MongoDB Compass

Connect Compass to the replica-set member URI
(`mongodb://127.0.0.1:27018/?replicaSet=rs0`), open `pharma_stock_management`, and
inspect the collections. Open a batch to show the `medicine` and `supplier`
`ObjectId` references. Open a sale to show its embedded `allocations` array, which
is a FEFO snapshot rather than a join.

## Atlas

Create an Atlas cluster, database user, network allowlist and connection string.
Keep `retryWrites=true` and `w=majority` so transactions are enabled, put the
encrypted string in `.env`, and never commit it. Run the same seed, `verify-db` and
`probe:transactions` commands against a disposable database there before trusting
the deployment.
