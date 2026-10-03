import "dotenv/config";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";

let server;
let baseUrl;
let token;
let viewerToken;
let skipReason = "";

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, options);
  const body = await response.json();
  return { response, body };
}

before(async () => {
  if (!process.env.MONGODB_URI) {
    skipReason = "MONGODB_URI is not configured";
    return;
  }
  try {
    await connectDB();
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const password = process.env.TEST_ADMIN_PASSWORD || process.env.SEED_PASSWORD;
    if (!password) {
      skipReason = "TEST_ADMIN_PASSWORD or SEED_PASSWORD is not configured";
      return;
    }
    const result = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: process.env.TEST_ADMIN_EMAIL || "admin@pharmastock.in", password }),
    });
    if (result.response.ok && result.body.success) token = result.body.data.token;
    else skipReason = "Seeded admin credentials were rejected";
    const viewerResult = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: process.env.TEST_VIEWER_EMAIL || "sateesh@pharmastock.in", password }),
    });
    if (viewerResult.response.ok && viewerResult.body.success) viewerToken = viewerResult.body.data.token;
  } catch (error) {
    skipReason = error.message;
  }
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

function authHeaders(accessToken = token) {
  return { Authorization: `Bearer ${accessToken}` };
}

test("health endpoint reports the database state", async () => {
  if (!baseUrl) return;
  const { response, body } = await request("/health");
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(["connected", "disconnected", "connecting", "disconnecting"].includes(body.database));
});

test("protected routes reject missing tokens", async () => {
  if (!baseUrl) return;
  const { response, body } = await request("/medicines");
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

test("authenticated read endpoints return stable response shapes", async (t) => {
  if (!token) return t.skip(skipReason || "Database integration is unavailable");
  const headers = authHeaders();
  const dashboard = await request("/dashboard", { headers });
  assert.equal(dashboard.response.status, 200);
  assert.ok(dashboard.body.data.kpis);
  for (const path of ["/medicines", "/batches", "/suppliers", "/purchases", "/sales", "/notifications"]) {
    const result = await request(path, { headers });
    assert.equal(result.response.status, 200, path);
    assert.ok(Array.isArray(result.body.data), path);
  }
  const report = await request("/reports?type=inventory", { headers });
  assert.equal(report.response.status, 200);
  assert.ok(Array.isArray(report.body.data));
  const search = await request("/search?q=para", { headers });
  assert.equal(search.response.status, 200);
  assert.ok(Array.isArray(search.body.data.medicines));
});

test("viewer accounts cannot perform inventory or audit administration", async (t) => {
  if (!viewerToken) return t.skip(skipReason || "Viewer credentials are unavailable");
  const headers = { ...authHeaders(viewerToken), "Content-Type": "application/json" };
  const medicine = await request("/medicines", { headers: authHeaders(viewerToken) });
  const payload = { name: "Denied Test", generic: "Denied", category: "Other", manufacturer: "Test", unitPrice: 1, reorderLevel: 1 };
  const create = await request("/medicines", { method: "POST", headers, body: JSON.stringify(payload) });
  assert.equal(create.response.status, 403);
  const audits = await request("/audit-logs", { headers: authHeaders(viewerToken) });
  assert.equal(audits.response.status, 403);
  assert.ok(Array.isArray(medicine.body.data));
});

test("invalid login does not disclose account state", async () => {
  if (!baseUrl) return;
  const result = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@pharmastock.in", password: "incorrect-password" }),
  });
  assert.equal(result.response.status, 401);
  assert.equal(result.body.error.message, "Invalid email or password");
});
