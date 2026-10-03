# PharmaStock Security

This document records the controls the codebase actually implements and the
trade-offs it knowingly accepts. It is not a claim of production readiness: this
is a course project with no deployed instance, no penetration test, and no
independent security review.

## Implemented controls

- Passwords are hashed with bcrypt (cost 12) and are excluded from normal queries
  by `select: false` on the `User` schema, so no code path can accidentally
  serialize a hash.
- `JWT_SECRET` must be at least 32 characters and must not be the documented
  placeholder; the API refuses to sign or verify a token otherwise.
- JWTs include an issuer, audience, expiry, subject, role, and email. The API
  reloads the active user on every authenticated request and rejects any account
  whose `status` is not `Active`, so a deactivated user loses access immediately
  rather than at token expiry.
- Role authorization is enforced by Express middleware: `Admin`,
  `Inventory Manager`, `Pharmacist`, `Sales Staff`, and `Viewer` have separate
  capabilities. Reading the alert feed is open to every role; acknowledging one
  is a state change and is restricted to inventory roles.
- Login has a dedicated rate limit that ignores successful attempts; the API has a
  separate global rate limit.
- Express is configured to trust `X-Forwarded-For` **only** when `TRUST_PROXY` is
  set. Trusting it unconditionally would let any client spoof its IP and defeat
  the per-IP limits.
- Helmet supplies secure HTTP response headers; CORS uses an explicit origin
  allowlist and answers a disallowed origin with `403 CORS_DENIED`.
- JSON and URL-encoded request bodies are limited to 1 MB.
- All write inputs pass centralized validation before controllers execute, and
  undeclared body fields are rejected rather than ignored, which blocks
  privilege escalation through mass assignment.
- Batch `quantity` and `costPerUnit` are not writable through any generic
  endpoint; the route layer refuses them with `BATCH_STOCK_IMMUTABLE` and the
  controller applies a second field whitelist.
- Search terms are escaped before use in regular expressions, and audit filters
  anchor the action pattern.
- Audit records capture actor, action, entity, IP address, user agent, metadata,
  and timestamp. Audit metadata is built from an explicit field whitelist at each
  call site, and credential-shaped keys are additionally redacted on read, so a
  password or token cannot reach the trail or the API response.
- The audit row for a purchase, sale, refund, or adjustment is written **inside
  the same transaction** as the stock movement, so a committed quantity can never
  be missing from the trail and a rolled-back movement never leaves an audit entry.
- Stock writes use MongoDB transactions and guarded quantity updates. There is no
  non-atomic fallback; a deployment that cannot run transactions gets
  `503 TRANSACTIONS_REQUIRED`.
- Error responses hide internal 5xx details when `NODE_ENV=production`.
- Users cannot change their own role or status, and cannot deactivate their own
  account, so a single Admin cannot lock everyone out of user administration.

## Known limitations

These are deliberate academic/demo trade-offs, not oversights:

- **JWT in `localStorage`.** The token is readable by any script on the origin, so
  an XSS flaw would leak the session. There is no CSRF token, because a bearer
  token in a header is not attached automatically by the browser. A production
  build should use a short-lived `HttpOnly`, `Secure`, `SameSite=Strict` cookie
  (which then requires CSRF protection) with refresh-token rotation.
- **Settings in `localStorage`.** UI preferences are per browser and per user of
  that browser. They are not an authorization boundary and must never hold
  anything sensitive.
- **No refresh tokens.** An expired token ends the session.
- **No account lockout or MFA.** Rate limiting raises the cost of guessing but
  does not prevent a distributed or slow attempt.
- **No automated accessibility scanner or penetration test** has been run against
  this codebase. Access control has been verified functionally (the role matrix is
  exercised by the browser E2E suite), not with a dedicated security scanner.

## Secret handling

Never commit `.env`, database credentials, JWT secrets, or seed passwords. Use a secret manager or protected CI environment variables in deployed environments. Rotate a JWT secret by invalidating existing sessions and restarting the API.

The seed requires both an explicit reset confirmation and `SEED_PASSWORD`. It is development-only and must not be run against production.

## Production checklist

- Use MongoDB Atlas or another replica-set deployment; a standalone server cannot execute stock transactions.
- Set a random `JWT_SECRET` of at least 32 characters.
- Set `NODE_ENV=production` and a narrow `CLIENT_ORIGIN` allowlist.
- Terminate TLS at the edge and use an encrypted MongoDB connection string.
- Restrict database network access and use a least-privilege database user.
- Configure log aggregation without logging passwords, JWTs, or full request bodies.
- Review audit retention and notification storage growth.
- Run dependency audits and keep CI blocking on high/critical findings.
- Rotate any credential that has appeared in source control, logs, screenshots, or coursework artifacts.

## Historical artifacts

The repository contains historical practical documents from earlier coursework. They are preserved as submitted artifacts and are not application configuration. Any credential found in those documents must be considered exposed and rotated outside the application.
