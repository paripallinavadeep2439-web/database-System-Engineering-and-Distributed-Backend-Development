# PharmaStock Deployment

## Local development

1. Start MongoDB as a replica set when testing inventory transactions.
2. Copy `Project/backend/.env.example` to `Project/backend/.env`.
3. Set `MONGODB_URI`, a random `JWT_SECRET`, `CLIENT_ORIGIN`, and a test-only `SEED_PASSWORD`.
4. Run `npm ci` in `Project/backend`.
5. Run `npm run seed -- --force` only against a disposable local database.
6. Run `npm run verify-db`.
7. Run `npm start` in `Project/backend`.
8. Run `npm install` and `npm run dev` in `Project/frontend`.
9. Open the Vite URL. The development proxy forwards `/api` to `http://localhost:5000`.

## Production frontend

```bash
cd Project/frontend
npm ci
npm run build
```

Serve `dist/` from a static host or reverse proxy. Configure `VITE_API_URL` at build time when the API is not same-origin. Do not expose API secrets through Vite environment variables.

## Production API

- Deploy `Project/backend` on Node.js 20 or newer (CI pins `24.19.0`; `package.json`
  declares `>=18`).
- Supply environment variables through the host secret manager.
- Use MongoDB Atlas or another replica-set deployment.
- Configure TLS, CORS, request limits, and process monitoring.
- `npm ci --omit=dev` is a no-op difference today, because the backend declares no
  `devDependencies`; use it anyway so a future dev dependency cannot ship.
- Use a process supervisor or container platform with graceful shutdown.
- Do not run the seed as a startup step.

## Environment variables

Supply these through the host's secret manager, not a committed file. Every
variable the code reads is documented in
[`.env.example`](../backend/.env.example); the ones that change deployment
behaviour are:

| Variable | Why it matters in production |
|---|---|
| `MONGODB_URI` | Must point at a replica-set or sharded cluster, encrypted in transit |
| `JWT_SECRET` | Random, at least 32 characters, unique per environment. Rotating it invalidates all existing sessions |
| `CLIENT_ORIGIN` | A narrow comma-separated allowlist. An origin outside it gets `403 CORS_DENIED` |
| `NODE_ENV` | Set to exactly `production` so 5xx responses stop returning internal detail |
| `TRUST_PROXY` | Only set this behind a proxy you control |
| `JWT_EXPIRES_IN` | Shorter lifetimes reduce the window of a leaked token |
| `RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_MAX` | Tune to expected traffic and proxy topology |
| `PORT` | Container port the platform routes to |

## Reverse proxy requirements

Forward `/api` to the Express service, preserve the `Authorization` header, and
terminate HTTPS. Restrict direct public access to MongoDB.

The API does **not** trust forwarded headers by default. `trust proxy` is enabled
only when `TRUST_PROXY` is set: `true` trusts one hop, `false` disables it, and a
comma-separated list trusts exactly those proxies. Leave it unset when the API is
not behind a proxy — trusting `X-Forwarded-For` unconditionally would let any
client spoof its IP and evade both rate limiters.

## Release verification

Run, in order: `npm run probe:transactions` (does this database actually run
transactions?), `npm run seed -- --force` and `npm run verify-db` against a
disposable database, `npm test` with `RUN_TRANSACTION_TESTS=true`, the frontend
production build, `npm audit --audit-level=high` in both packages, and an
authenticated API smoke test. Only accept stock mutations once the probe and the
transaction tests pass against the deployment's own MongoDB.

## Scope of this document

There is no deployed instance of PharmaStock. This file records the requirements a
deployment would have to meet; it is not evidence that such a deployment exists,
and nothing in this repository should be read as a production-readiness claim.
