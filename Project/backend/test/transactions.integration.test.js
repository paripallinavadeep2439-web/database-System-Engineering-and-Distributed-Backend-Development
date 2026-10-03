import "dotenv/config";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import Medicine from "../src/models/Medicine.js";
import Supplier from "../src/models/Supplier.js";
import Batch from "../src/models/Batch.js";
import Purchase from "../src/models/Purchase.js";
import Sale from "../src/models/Sale.js";
import Notification from "../src/models/Notification.js";
import AuditLog from "../src/models/AuditLog.js";
import InventoryAdjustment from "../src/models/InventoryAdjustment.js";

function idOf(value) {
  return value ? String(value._id || value) : "";
}

const enabled = process.env.RUN_TRANSACTION_TESTS === "true" && Boolean(process.env.MONGODB_URI && process.env.SEED_PASSWORD);
const password = process.env.SEED_PASSWORD;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
// `node --test` runs api.test.js and this file in parallel against the same
// database, so any assertion about the total number of audit rows races with
// the other suite. Every request here carries a suite-specific User-Agent and
// audit assertions are scoped to it, which keeps them exact.
const suiteUserAgent = `pharmastock-ci-${suffix}`;
let server;
let baseUrl;
let adminToken;
let supplier;
let medicine;
let batchA;
let batchB;
let expiredBatch;
let purchaseBatch;
let rollbackBatch;
let createdEntityIds = [];

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, { ...options, headers: { "User-Agent": suiteUserAgent, ...(options.headers || {}) } });
  const body = await response.json();
  return { status: response.status, body };
}

function auth(json = false) {
  return { ...(json ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${adminToken}` };
}

function day(offset) {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offset);
  return value;
}

before(async () => {
  if (!enabled) return;
  await connectDB();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const login = await request("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: process.env.TEST_ADMIN_EMAIL || "admin@pharmastock.in", password }) });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  adminToken = login.body.data.token;
  supplier = await Supplier.create({ name: `CI Supplier ${suffix}`, contact: "CI Tester", status: "Active" });
  medicine = await Medicine.create({ name: `CI Medicine ${suffix}`, generic: "CI Generic", category: "Other", manufacturer: "CI Manufacturer", unitPrice: 5, reorderLevel: 1 });
  purchaseBatch = await Batch.create({ batchNo: `CI-P-${suffix}`, medicine: medicine._id, supplier: supplier._id, manufactureDate: day(-20), expiryDate: day(120), quantity: 10, costPerUnit: 2 });
  batchA = await Batch.create({ batchNo: `CI-A-${suffix}`, medicine: medicine._id, supplier: supplier._id, manufactureDate: day(-20), expiryDate: day(30), quantity: 100, costPerUnit: 2 });
  batchB = await Batch.create({ batchNo: `CI-B-${suffix}`, medicine: medicine._id, supplier: supplier._id, manufactureDate: day(-20), expiryDate: day(90), quantity: 200, costPerUnit: 3 });
  expiredBatch = await Batch.create({ batchNo: `CI-X-${suffix}`, medicine: medicine._id, supplier: supplier._id, manufactureDate: day(-60), expiryDate: day(-1), quantity: 500, costPerUnit: 1 });
  rollbackBatch = await Batch.create({ batchNo: `CI-R-${suffix}`, medicine: medicine._id, supplier: supplier._id, manufactureDate: day(-20), expiryDate: day(120), quantity: 20, costPerUnit: 2 });
  createdEntityIds = [supplier._id, medicine._id, purchaseBatch._id, batchA._id, batchB._id, expiredBatch._id, rollbackBatch._id];
});

after(async () => {
  if (!enabled) return;
  if (createdEntityIds.length) {
    await Promise.all([
      Supplier.deleteMany({ _id: { $in: createdEntityIds } }),
      Medicine.deleteMany({ _id: { $in: createdEntityIds } }),
      Batch.deleteMany({ _id: { $in: createdEntityIds } }),
      Purchase.deleteMany({ medicine: medicine?._id }),
      Sale.deleteMany({ medicine: medicine?._id }),
      InventoryAdjustment.deleteMany({ medicine: medicine?._id }),
      Notification.deleteMany({ entityId: { $in: createdEntityIds } }),
      AuditLog.deleteMany({ entityId: { $in: createdEntityIds } }),
    ]);
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

test("purchase transaction commits stock and purchase", async (t) => {
  if (!enabled) return t.skip("set RUN_TRANSACTION_TESTS=true with a replica-set MONGODB_URI");
  const result = await request("/purchases", { method: "POST", headers: auth(true), body: JSON.stringify({ medicineId: String(medicine._id), supplierId: String(supplier._id), batchId: String(purchaseBatch._id), quantity: 5, unitCost: 3 }) });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal((await Batch.findById(purchaseBatch._id).lean()).quantity, 15);
  assert.equal(await Purchase.countDocuments({ batch: purchaseBatch._id }), 1);
  assert.equal(await AuditLog.countDocuments({ action: "PURCHASE_CREATE", entityId: result.body.data.id }), 1);
});

test("sale transaction applies exact FEFO allocations", async (t) => {
  if (!enabled) return t.skip("set RUN_TRANSACTION_TESTS=true with a replica-set MONGODB_URI");
  const result = await request("/sales", { method: "POST", headers: auth(true), body: JSON.stringify({ medicineId: String(medicine._id), quantity: 150, unitPrice: 5 }) });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  const sale = await Sale.findById(result.body.data.id).lean();
  assert.deepEqual(sale.allocations.map((allocation) => [allocation.batchNo, allocation.quantity]), [[batchA.batchNo, 100], [batchB.batchNo, 50]]);
  assert.equal((await Batch.findById(batchA._id).lean()).quantity, 0);
  assert.equal((await Batch.findById(batchB._id).lean()).quantity, 150);
  assert.equal((await Batch.findById(expiredBatch._id).lean()).quantity, 500);
});

test("insufficient and expired stock leave inventory and sales unchanged", async (t) => {
  if (!enabled) return t.skip("set RUN_TRANSACTION_TESTS=true with a replica-set MONGODB_URI");
  const before = await Batch.find({ medicine: medicine._id }).sort({ batchNo: 1 }).lean();
  const saleCount = await Sale.countDocuments({ medicine: medicine._id });
  const auditCount = await AuditLog.countDocuments({ userAgent: suiteUserAgent });
  const available = before.filter((batch) => batch.expiryDate >= day(0) && batch.quantity > 0).reduce((sum, batch) => sum + batch.quantity, 0);
  const insufficient = await request("/sales", { method: "POST", headers: auth(true), body: JSON.stringify({ medicineId: String(medicine._id), quantity: available + 1 }) });
  assert.equal(insufficient.status, 409);
  assert.deepEqual(await Batch.find({ medicine: medicine._id }).sort({ batchNo: 1 }).lean(), before);
  assert.equal(await Sale.countDocuments({ medicine: medicine._id }), saleCount);
  assert.equal(await AuditLog.countDocuments({ userAgent: suiteUserAgent }), auditCount);
  const expiredMedicine = await Medicine.create({ name: `CI Expired ${suffix}`, generic: "Expired", category: "Other", manufacturer: "CI", unitPrice: 1, reorderLevel: 1 });
  const expired = await Batch.create({ batchNo: `CI-EXPIRED-${suffix}`, medicine: expiredMedicine._id, supplier: supplier._id, manufactureDate: day(-60), expiryDate: day(-1), quantity: 7, costPerUnit: 1 });
  const expiredResult = await request("/sales", { method: "POST", headers: auth(true), body: JSON.stringify({ medicineId: String(expiredMedicine._id), quantity: 1 }) });
  assert.equal(expiredResult.status, 409);
  assert.equal((await Batch.findById(expired._id).lean()).quantity, 7);
  assert.equal(await Sale.countDocuments({ medicine: expiredMedicine._id }), 0);
  await Medicine.deleteOne({ _id: expiredMedicine._id });
  await Batch.deleteOne({ _id: expired._id });
});

test("forced failure after batch mutation rolls back sale and inventory", async (t) => {
  if (!enabled) return t.skip("set RUN_TRANSACTION_TESTS=true with a replica-set MONGODB_URI");
  const before = await Batch.findById(rollbackBatch._id).lean();
  const saleCount = await Sale.countDocuments({ medicine: medicine._id });
  const originalCreate = Notification.create;
  Notification.create = async () => { throw new Error("forced rollback"); };
  try {
    const result = await request("/sales", { method: "POST", headers: auth(true), body: JSON.stringify({ medicineId: String(medicine._id), quantity: 5 }) });
    assert.equal(result.status, 500);
  } finally {
    Notification.create = originalCreate;
  }
  assert.deepEqual(await Batch.findById(rollbackBatch._id).lean(), before);
  assert.equal(await Sale.countDocuments({ medicine: medicine._id }), saleCount);
});

test("refund returns exactly the allocated units to the allocated batches", async (t) => {
  if (!enabled) return t.skip("set RUN_TRANSACTION_TESTS=true with a replica-set MONGODB_URI");
  const sale = (await Sale.find({ medicine: medicine._id, status: "Completed" }).sort({ createdAt: -1 }).lean())[0];
  assert.ok(sale, "a completed sale is required for the refund test");
  const before = new Map();
  for (const allocation of sale.allocations) {
    before.set(idOf(allocation.batch), (await Batch.findById(allocation.batch).lean()).quantity);
  }
  const result = await request(`/sales/${sale._id}/refund`, { method: "POST", headers: auth(true), body: JSON.stringify({ reason: "Automated refund test" }) });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  const refunded = await Sale.findById(sale._id).lean();
  assert.equal(refunded.status, "Refunded");
  assert.ok(refunded.refundedAt, "a refund must record when it happened");
  for (const allocation of sale.allocations) {
    const batch = await Batch.findById(allocation.batch).lean();
    assert.equal(batch.quantity, before.get(idOf(allocation.batch)) + allocation.quantity, `batch ${allocation.batchNo} was not replenished`);
  }
  assert.equal(await AuditLog.countDocuments({ action: "SALE_REFUND", entityId: sale._id }), 1);
  // A refund is final; the same sale cannot be refunded twice and double the stock.
  const second = await request(`/sales/${sale._id}/refund`, { method: "POST", headers: auth(true), body: JSON.stringify({ reason: "duplicate" }) });
  assert.equal(second.status, 409);
  for (const allocation of sale.allocations) {
    const batch = await Batch.findById(allocation.batch).lean();
    assert.equal(batch.quantity, before.get(idOf(allocation.batch)) + allocation.quantity);
  }
});

test("inventory adjustment records before/after and never drives stock negative", async (t) => {
  if (!enabled) return t.skip("set RUN_TRANSACTION_TESTS=true with a replica-set MONGODB_URI");
  const target = await Batch.findOne({ _id: rollbackBatch._id }).lean();
  const result = await request("/adjustments", { method: "POST", headers: auth(true), body: JSON.stringify({ medicineId: String(medicine._id), batchId: String(rollbackBatch._id), quantityDelta: -7, reason: "Automated adjustment test" }) });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.data.quantityBefore, target.quantity);
  assert.equal(result.body.data.quantityAfter, target.quantity - 7);
  assert.equal(result.body.data.quantityDelta, -7);
  assert.equal((await Batch.findById(rollbackBatch._id).lean()).quantity, target.quantity - 7);
  assert.equal(await AuditLog.countDocuments({ action: "INVENTORY_ADJUSTMENT", entityId: result.body.data.id }), 1);
  // More units than the batch holds must be refused outright.
  const oversized = await request("/adjustments", { method: "POST", headers: auth(true), body: JSON.stringify({ medicineId: String(medicine._id), batchId: String(rollbackBatch._id), quantityDelta: -9999, reason: "oversized" }) });
  assert.equal(oversized.status, 409);
  assert.equal((await Batch.findById(rollbackBatch._id).lean()).quantity, target.quantity - 7);
  // A zero delta is not a meaningful adjustment.
  const zero = await request("/adjustments", { method: "POST", headers: auth(true), body: JSON.stringify({ medicineId: String(medicine._id), batchId: String(rollbackBatch._id), quantityDelta: 0, reason: "zero" }) });
  assert.equal(zero.status, 400);
});

test("direct batch quantity and cost writes are refused over HTTP", async (t) => {
  if (!enabled) return t.skip("set RUN_TRANSACTION_TESTS=true with a replica-set MONGODB_URI");
  const before = await Batch.findById(batchB._id).lean();
  const quantity = await request(`/batches/${batchB._id}`, { method: "PATCH", headers: auth(true), body: JSON.stringify({ quantity: 999 }) });
  assert.equal(quantity.status, 400);
  assert.match(quantity.body.error.message, /cannot be edited directly/i);
  const cost = await request(`/batches/${batchB._id}`, { method: "PATCH", headers: auth(true), body: JSON.stringify({ costPerUnit: 999 }) });
  assert.equal(cost.status, 400);
  const create = await request("/batches", { method: "POST", headers: auth(true), body: JSON.stringify({ medicineId: String(medicine._id), supplierId: String(supplier._id), manufactureDate: day(-1).toISOString(), expiryDate: day(90).toISOString(), quantity: 50, costPerUnit: 2 }) });
  assert.equal(create.status, 400, "creating a batch with stock must be refused");
  assert.deepEqual(await Batch.findById(batchB._id).lean(), before);
});

test("a batch cannot be reassigned away from its recorded ledger", async (t) => {
  if (!enabled) return t.skip("set RUN_TRANSACTION_TESTS=true with a replica-set MONGODB_URI");
  const other = await Medicine.create({ name: `CI Other ${suffix}`, generic: "Other Generic", category: "Other", manufacturer: "CI", unitPrice: 5, reorderLevel: 1 });
  createdEntityIds.push(other._id);
  // batchB has recorded sale allocations, so moving it to another medicine would
  // detach those allocations and corrupt COGS.
  const result = await request(`/batches/${batchB._id}`, { method: "PATCH", headers: auth(true), body: JSON.stringify({ medicineId: String(other._id) }) });
  assert.equal(result.status, 400);
  assert.match(result.body.error.message, /cannot be reassigned/i);
  assert.equal(String((await Batch.findById(batchB._id).lean()).medicine), String(medicine._id));
});
