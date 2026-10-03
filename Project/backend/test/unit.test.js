import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { dateValue, enumValue, numberValue, objectId, rejectFields, requiredString, validateBody } from "../src/utils/validation.js";
import { batchStatus, serializeBatch } from "../src/utils/serializers.js";
import { dateRangeFilter } from "../src/utils/dates.js";
import { sortFefoBatches } from "../src/services/transactionService.js";

test("requiredString trims and rejects short values", () => {
  assert.equal(requiredString("  value  ", "field"), "value");
  assert.throws(() => requiredString("", "field"), (error) => error.status === 400);
});

test("numberValue enforces bounds and integer mode", () => {
  assert.equal(numberValue("4", "quantity", { min: 1, integer: true }), 4);
  assert.throws(() => numberValue("1.5", "quantity", { integer: true }));
  assert.throws(() => numberValue("-1", "quantity", { min: 0 }));
});

test("objectId, enumValue, and dateValue normalize valid input", () => {
  const id = new mongoose.Types.ObjectId();
  assert.equal(objectId(String(id), "id"), String(id));
  assert.equal(enumValue("Active", "status", ["Active", "Inactive"]), "Active");
  assert.equal(dateValue("2026-01-02", "date").toISOString().slice(0, 10), "2026-01-02");
});

test("validateBody normalises declared fields", () => {
  const req = { body: { name: "  Demo  " } };
  const res = {};
  let called = false;
  validateBody({ name: [(value) => requiredString(value, "name")] })(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.deepEqual(req.body, { name: "Demo" });
});

test("validateBody rejects undeclared fields so mass assignment is impossible", () => {
  const req = { body: { name: "Demo", role: "Admin", isActive: false } };
  const res = {};
  let nextError = null;
  validateBody({ name: [(value) => requiredString(value, "name")] })(req, res, (error) => { nextError = error; });
  assert.equal(nextError?.status, 400, "an unknown privilege-escalating field must be refused");
  assert.deepEqual(nextError?.details?.fields, ["isActive", "role"]);
});

test("validateBody can opt in to extra fields for endpoints that need the raw body", () => {
  const req = { body: { name: "Demo", extra: true } };
  const res = {};
  validateBody({ name: [(value) => requiredString(value, "name")] }, { allowUnknownFields: true })(req, res, () => {});
  assert.deepEqual(req.body, { name: "Demo", extra: true });
});

test("rejectFields blocks a protected value even when it is otherwise valid", () => {
  const req = { body: { batchNo: "B-1", quantity: 5 } };
  const res = {};
  let nextError = null;
  validateBody({
    batchNo: [(value) => requiredString(value, "batchNo")],
    quantity: [rejectFields("Batch quantity cannot be edited directly.")],
  })(req, res, (error) => { nextError = error; });
  assert.equal(nextError?.status, 400);
});

test("dateRangeFilter treats a date-only to value as the whole day", () => {
  const filter = dateRangeFilter({ from: "2026-03-01", to: "2026-03-31" });
  assert.equal(filter.date.$gte.toISOString(), "2026-03-01T00:00:00.000Z");
  // 23:59:59.999Z, not 00:00:00Z, so the final day is actually included.
  assert.equal(filter.date.$lte.toISOString(), "2026-03-31T23:59:59.999Z");
});

test("batchStatus counts expiry days in UTC and never labels an expired batch active", () => {
  const now = new Date("2026-06-15T18:00:00Z");
  assert.equal(batchStatus({ quantity: 5, expiryDate: "2026-06-14T23:00:00Z" }, now), "Expired");
  assert.equal(batchStatus({ quantity: 5, expiryDate: "2026-07-14T08:00:00Z" }, now), "Near Expiry");
  assert.equal(batchStatus({ quantity: 5, expiryDate: "2027-01-01T00:00:00Z" }, now), "Active");
  // Quantity decides status even when the expiry is still far away.
  assert.equal(batchStatus({ quantity: 0, expiryDate: "2027-01-01T00:00:00Z" }, now), "Depleted");
});

test("FEFO ordering uses expiry before creation and id tie-breakers", () => {
  const first = new mongoose.Types.ObjectId();
  const second = new mongoose.Types.ObjectId();
  const batches = [
    { _id: second, expiryDate: "2027-01-01", createdAt: "2026-01-01" },
    { _id: first, expiryDate: "2026-01-01", createdAt: "2026-02-01" },
  ];
  assert.equal(sortFefoBatches(batches)[0]._id, first);
  assert.deepEqual(sortFefoBatches(batches).map((batch) => String(batch._id)), [String(first), String(second)]);
});

test("batch serialization preserves references and derives status", () => {
  const medicineId = new mongoose.Types.ObjectId();
  const supplierId = new mongoose.Types.ObjectId();
  const tomorrow = new Date(Date.now() + 86400000);
  const batch = serializeBatch({
    _id: new mongoose.Types.ObjectId(),
    batchNo: "B-1",
    medicine: medicineId,
    supplier: supplierId,
    manufactureDate: new Date(Date.now() - 86400000),
    expiryDate: tomorrow,
    quantity: 4,
    costPerUnit: 2.5,
  });
  assert.equal(batch.medicineId, String(medicineId));
  assert.equal(batch.supplierId, String(supplierId));
  assert.equal(batch.status, "Near Expiry");
  assert.equal(batchStatus({ expiryDate: new Date(Date.now() - 86400000), quantity: 2 }), "Expired");
});

test("the Batch model status virtual cannot drift from the serialized status", async () => {
  const Batch = (await import("../src/models/Batch.js")).default;
  const today = new Date();
  const cases = [
    { quantity: 5, expiryDate: new Date(today.getTime() - 5 * 86400000) },
    { quantity: 5, expiryDate: new Date(today.getTime() + 10 * 86400000) },
    { quantity: 5, expiryDate: new Date(today.getTime() + 400 * 86400000) },
    { quantity: 0, expiryDate: new Date(today.getTime() + 400 * 86400000) },
  ];
  for (const scenario of cases) {
    const doc = new Batch({
      batchNo: `DRIFT-${Math.random().toString(36).slice(2, 8)}`,
      medicine: new mongoose.Types.ObjectId(),
      supplier: new mongoose.Types.ObjectId(),
      manufactureDate: new Date(today.getTime() - 30 * 86400000),
      expiryDate: scenario.expiryDate,
      quantity: scenario.quantity,
      costPerUnit: 1,
    });
    assert.equal(doc.status, batchStatus(scenario), `model virtual disagreed for expiry ${scenario.expiryDate.toISOString()}`);
  }
});
