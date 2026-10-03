import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Medicine from "../models/Medicine.js";
import Supplier from "../models/Supplier.js";
import Batch from "../models/Batch.js";
import Purchase from "../models/Purchase.js";
import Sale from "../models/Sale.js";
import InventoryAdjustment from "../models/InventoryAdjustment.js";
import AuditLog from "../models/AuditLog.js";
import { startOfDayUtc } from "../utils/dates.js";

const REQUIRED_FIELDS = {
  users: ["name", "email", "password", "role", "status", "joined"],
  medicines: ["name", "generic", "category", "manufacturer", "dosage", "unitPrice", "reorderLevel"],
  suppliers: ["name", "contact", "status"],
  batches: ["batchNo", "medicine", "supplier", "manufactureDate", "expiryDate", "quantity", "costPerUnit"],
  purchases: ["purchaseNo", "supplier", "medicine", "batch", "quantity", "unitCost", "total", "date", "status", "createdBy"],
  sales: ["saleNo", "medicine", "batch", "allocations", "quantity", "unitPrice", "total", "date", "status", "createdBy"],
  inventoryAdjustments: ["medicine", "batch", "quantityDelta", "quantityBefore", "quantityAfter", "reason", "createdBy"],
};

// Minimum scale the demo dataset must reach for every screen and report to have
// something meaningful to show. Exact counts are deliberately not asserted
// because the seed derives its own ledger size. Counts are read through the
// models rather than by guessed collection name, because Mongoose derives names
// like `inventoryadjustments` and would silently report 0 for `inventoryAdjustments`.
const MODELS = [
  { label: "users", model: User, minimum: 7 },
  { label: "medicines", model: Medicine, minimum: 30 },
  { label: "suppliers", model: Supplier, minimum: 5 },
  { label: "batches", model: Batch, minimum: 40 },
  { label: "purchases", model: Purchase, minimum: 40 },
  { label: "sales", model: Sale, minimum: 40 },
  { label: "inventoryAdjustments", model: InventoryAdjustment, minimum: 1 },
  { label: "auditLogs", model: AuditLog, minimum: 1 },
];

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function idOf(value) {
  return value ? String(value._id || value) : "";
}

function hasRequiredFields(documents, fields) {
  return documents.every((document) => fields.every((field) => document[field] !== undefined && document[field] !== null));
}

async function verify() {
  let allOk = true;
  const fail = (message) => { allOk = false; console.error(`FAIL: ${message}`); };
  const pass = (message) => console.log(`OK: ${message}`);
  const [users, medicines, suppliers, batches, purchases, sales, adjustments] = await Promise.all([
    User.find().select("+password").lean(),
    Medicine.find().lean(),
    Supplier.find().lean(),
    Batch.find().lean(),
    Purchase.find().lean(),
    Sale.find().lean(),
    InventoryAdjustment.find().lean(),
  ]);
  const ids = {
    users: new Set(users.map(idOf)),
    medicines: new Set(medicines.map(idOf)),
    suppliers: new Set(suppliers.map(idOf)),
    batches: new Set(batches.map(idOf)),
  };

  if (!hasRequiredFields(users, REQUIRED_FIELDS.users)) fail("users contain missing required fields");
  else if (!users.every((user) => /^\$2[aby]\$/.test(user.password || ""))) fail("one or more user passwords are not bcrypt hashed");
  else pass(`${users.length} users contain required fields and bcrypt hashes`);
  // A plaintext or empty password would let anyone authenticate as a seeded user.
  if (users.some((user) => String(user.password || "").length < 50)) fail("one or more user passwords are not a full bcrypt hash");

  if (!hasRequiredFields(medicines, REQUIRED_FIELDS.medicines)) fail("medicines contain missing required fields");
  else pass(`${medicines.length} medicines contain required fields`);

  if (!hasRequiredFields(suppliers, REQUIRED_FIELDS.suppliers)) fail("suppliers contain missing required fields");
  else pass(`${suppliers.length} suppliers contain required fields`);

  if (!hasRequiredFields(batches, REQUIRED_FIELDS.batches)) fail("batches contain missing required fields");
  for (const batch of batches) {
    if (!ids.medicines.has(idOf(batch.medicine))) fail(`batch ${batch.batchNo} has an orphan medicine reference`);
    if (!ids.suppliers.has(idOf(batch.supplier))) fail(`batch ${batch.batchNo} has an orphan supplier reference`);
    if (!Number.isInteger(batch.quantity) || batch.quantity < 0) fail(`batch ${batch.batchNo} has invalid quantity`);
    if (!Number.isFinite(batch.costPerUnit) || batch.costPerUnit < 0) fail(`batch ${batch.batchNo} has an invalid unit cost`);
    if (new Date(batch.expiryDate) <= new Date(batch.manufactureDate)) fail(`batch ${batch.batchNo} has an invalid expiry state`);
  }
  if (allOk) pass(`${batches.length} batches contain required fields and valid references`);

  if (!hasRequiredFields(purchases, REQUIRED_FIELDS.purchases)) fail("purchases contain missing required fields");
  for (const purchase of purchases) {
    if (!ids.suppliers.has(idOf(purchase.supplier))) fail(`purchase ${purchase.purchaseNo} has an orphan supplier reference`);
    if (!ids.medicines.has(idOf(purchase.medicine))) fail(`purchase ${purchase.purchaseNo} has an orphan medicine reference`);
    if (!ids.batches.has(idOf(purchase.batch))) fail(`purchase ${purchase.purchaseNo} has an orphan batch reference`);
    if (!ids.users.has(idOf(purchase.createdBy))) fail(`purchase ${purchase.purchaseNo} has an orphan user reference`);
    if (purchase.batch && String(batches.find((batch) => idOf(batch) === idOf(purchase.batch))?.medicine) !== idOf(purchase.medicine)) {
      fail(`purchase ${purchase.purchaseNo} references a batch belonging to a different medicine`);
    }
    if (Number(purchase.paidAmount || 0) > Number(purchase.total || 0)) fail(`purchase ${purchase.purchaseNo} has an invalid paid amount`);
    if (Math.abs(Number(purchase.total || 0) - roundMoney(Number(purchase.quantity || 0) * Number(purchase.unitCost || 0))) > 0.01) fail(`purchase ${purchase.purchaseNo} has an invalid total`);
    // Paid status and paid amount must agree, so the supplier payment-compliance
    // metric can never report a settled order that was never paid.
    if (purchase.status === "Paid" && Math.abs(Number(purchase.paidAmount || 0) - Number(purchase.total || 0)) > 0.01) fail(`purchase ${purchase.purchaseNo} is marked Paid but is not fully paid`);
    if (purchase.status === "Pending" && Number(purchase.paidAmount || 0) > 0.01) fail(`purchase ${purchase.purchaseNo} is Pending but has a non-zero paid amount`);
  }
  if (allOk) pass(`${purchases.length} purchases contain required fields and valid references`);

  // Batch id -> the date its stock was first received, used for sale causality.
  const purchaseDateByBatch = new Map(purchases.map((purchase) => [idOf(purchase.batch), new Date(purchase.date)]));
  if (!hasRequiredFields(sales, REQUIRED_FIELDS.sales)) fail("sales contain missing required fields");
  for (const sale of sales) {
    if (!ids.medicines.has(idOf(sale.medicine))) fail(`sale ${sale.saleNo} has an orphan medicine reference`);
    if (!ids.batches.has(idOf(sale.batch))) fail(`sale ${sale.batch && idOf(sale.batch)} has an orphan batch reference`);
    if (!ids.users.has(idOf(sale.createdBy))) fail(`sale ${sale.saleNo} has an orphan user reference`);
    if (Math.abs(Number(sale.total || 0) - roundMoney(Number(sale.quantity || 0) * Number(sale.unitPrice || 0))) > 0.01) fail(`sale ${sale.saleNo} has an invalid total`);
    if (!Array.isArray(sale.allocations) || sale.allocations.length === 0) fail(`sale ${sale.saleNo} has no stock allocations`);
    let allocatedQuantity = 0;
    for (const allocation of sale.allocations || []) {
      if (!ids.batches.has(idOf(allocation.batch))) fail(`sale ${sale.saleNo} allocates an unknown batch`);
      if (!Number.isInteger(allocation.quantity) || allocation.quantity < 1) fail(`sale ${sale.saleNo} has an invalid allocation quantity`);
      allocatedQuantity += Number(allocation.quantity || 0);
      const allocatedBatch = batches.find((batch) => idOf(batch) === idOf(allocation.batch));
      if (allocatedBatch && idOf(allocatedBatch.medicine) !== idOf(sale.medicine)) fail(`sale ${sale.saleNo} allocates a batch from another medicine`);
      if (allocation.batchNo && allocatedBatch && allocation.batchNo !== allocatedBatch.batchNo) fail(`sale ${sale.saleNo} stored a stale batch number in its allocation snapshot`);
    }
    if (allocatedQuantity !== Number(sale.quantity)) fail(`sale ${sale.saleNo} allocation quantity does not match sale quantity`);
    // Causality: stock cannot be sold before it was received. Random date ranges
    // silently produced such records, so the ordering is now enforced rather than
    // assumed.
    for (const allocation of sale.allocations || []) {
      const received = purchaseDateByBatch.get(idOf(allocation.batch));
      if (received && new Date(sale.date) < new Date(received)) {
        fail(`sale ${sale.saleNo} is dated before the purchase that received batch ${allocation.batchNo || idOf(allocation.batch)}`);
        break;
      }
    }
    // A refund is a real state change: it must carry a timestamp, and a sale that
    // was never refunded must not have one.
    if (sale.status === "Refunded" && !sale.refundedAt) fail(`sale ${sale.saleNo} is Refunded without a refundedAt timestamp`);
    if (sale.status === "Completed" && sale.refundedAt) fail(`sale ${sale.saleNo} is Completed but carries a refundedAt timestamp`);
    if (sale.status === "Refunded" && sale.refundedAt && new Date(sale.refundedAt) < new Date(sale.date)) {
      fail(`sale ${sale.saleNo} was refunded before it was sold`);
    }
  }
  if (allOk) pass(`${sales.length} sales contain required fields and valid references`);

  if (adjustments.length && !hasRequiredFields(adjustments, REQUIRED_FIELDS.inventoryAdjustments)) fail("inventory adjustments contain missing required fields");
  for (const adjustment of adjustments) {
    if (!ids.medicines.has(idOf(adjustment.medicine))) fail(`inventory adjustment ${idOf(adjustment)} has an orphan medicine reference`);
    if (!ids.batches.has(idOf(adjustment.batch))) fail(`inventory adjustment ${idOf(adjustment)} has an orphan batch reference`);
    if (!ids.users.has(idOf(adjustment.createdBy))) fail(`inventory adjustment ${idOf(adjustment)} has an orphan user reference`);
    if (!Number.isInteger(adjustment.quantityDelta) || adjustment.quantityDelta === 0) fail(`inventory adjustment ${idOf(adjustment)} has an invalid quantity delta`);
    // before + delta === after is what makes the adjustment auditable.
    if (Number(adjustment.quantityBefore) + Number(adjustment.quantityDelta) !== Number(adjustment.quantityAfter)) {
      fail(`inventory adjustment ${idOf(adjustment)} does not reconcile (before + delta !== after)`);
    }
    if (Number(adjustment.quantityAfter) < 0) fail(`inventory adjustment ${idOf(adjustment)} results in a negative quantity`);
  }
  if (allOk) pass(`${adjustments.length} inventory adjustments contain valid references`);

  // ---- Ledger reconciliation -------------------------------------------------
  // The single most important invariant: every batch's stored quantity must equal
  // what its ledger says it should be. If this passes, stock on screen is
  // provably derived from purchases, sales, refunds and adjustments rather than
  // being hand-written by the seed.
  const today = startOfDayUtc();
  const soldOut = new Map();
  for (const sale of sales) {
    // A refunded sale's units came back, so they do not count as consumed.
    const multiplier = sale.status === "Refunded" ? 0 : 1;
    for (const allocation of sale.allocations || []) {
      const key = idOf(allocation.batch);
      soldOut.set(key, (soldOut.get(key) || 0) + Number(allocation.quantity || 0) * multiplier);
    }
  }
  const adjusted = new Map();
  for (const adjustment of adjustments) {
    const key = idOf(adjustment.batch);
    adjusted.set(key, (adjusted.get(key) || 0) + Number(adjustment.quantityDelta || 0));
  }
  const receivedIn = new Map();
  for (const purchase of purchases) {
    const key = idOf(purchase.batch);
    receivedIn.set(key, (receivedIn.get(key) || 0) + Number(purchase.quantity || 0));
  }
  let ledgerOk = true;
  const orphanedStock = [];
  for (const batch of batches) {
    const key = idOf(batch);
    const expected = (receivedIn.get(key) || 0) - (soldOut.get(key) || 0) + (adjusted.get(key) || 0);
    if (expected !== Number(batch.quantity)) {
      ledgerOk = false;
      fail(`batch ${batch.batchNo} quantity ${batch.quantity} does not match its ledger (${receivedIn.get(key) || 0} received - ${soldOut.get(key) || 0} sold + ${adjusted.get(key) || 0} adjusted = ${expected})`);
    }
    if (expected < 0) orphanedStock.push(batch.batchNo);
  }
  if (ledgerOk) pass("every batch quantity reconciles with the purchase/sale/refund/adjustment ledger");
  if (orphanedStock.length) fail(`batches would have had a negative quantity mid-ledger: ${orphanedStock.join(", ")}`);

  // ---- Sellable vs. expired stock --------------------------------------------
  const expiredWithStock = batches.filter((batch) => new Date(batch.expiryDate) < today && batch.quantity > 0);
  if (expiredWithStock.length) fail(`${expiredWithStock.length} expired batch(es) still hold stock (${expiredWithStock.slice(0, 5).map((batch) => batch.batchNo).join(", ")})`);
  else pass("no expired batch still holds stock");
  const lowStock = medicines.filter((medicine) => {
    const units = batches
      .filter((batch) => idOf(batch.medicine) === idOf(medicine) && new Date(batch.expiryDate) >= today)
      .reduce((total, batch) => total + Number(batch.quantity || 0), 0);
    return units < medicine.reorderLevel;
  });
  const nearExpiry = batches.filter((batch) => {
    const days = Math.round((startOfDayUtc(batch.expiryDate) - today) / 86400000);
    return days >= 0 && days <= 30;
  });
  pass(`${lowStock.length} medicine(s) are below reorder level and ${nearExpiry.length} batch(es) are near expiry, so alerts and reports are populated`);
  const refunded = sales.filter((sale) => sale.status === "Refunded");
  if (refunded.length) pass(`${refunded.length} refunded sale(s) present, so the refund ledger is exercised`);
  else console.log("WARN: no refunded sales, the refund ledger is not represented in this dataset");

  // ---- Indexes ---------------------------------------------------------------
  // syncIndexes drops indexes that are no longer declared in a schema, so a
  // stale or hand-added index cannot silently remain and skew query plans.
  for (const { label, model } of MODELS) {
    try {
      await model.syncIndexes();
    } catch (error) {
      fail(`${label} index sync failed: ${error.message}`);
      continue;
    }
    const indexes = await model.collection.indexes();
    const secondary = indexes.filter((index) => index.name !== "_id_");
    if (!secondary.length) fail(`${label} has no secondary indexes`);
    else pass(`${label}: ${secondary.length} secondary index(es) present`);
  }
  // The FEFO allocation query filters on medicine, expiry and quantity together,
  // so the compound index is load-bearing rather than decorative.
  const batchIndexes = await Batch.collection.indexes();
  if (!batchIndexes.some((index) => index.key?.medicine === 1 && index.key?.expiryDate === 1 && index.key?.quantity === 1)) {
    fail("batch medicine/expiry/quantity compound index is missing");
  } else pass("batch medicine/expiry/quantity compound index exists");
  if (!batchIndexes.some((index) => index.unique === true && index.key?.batchNo === 1)) fail("batch batchNo unique index is missing");
  else pass("batch batchNo unique index exists");
  const saleIndexes = await Sale.collection.indexes();
  if (!saleIndexes.some((index) => index.unique === true && index.key?.saleNo === 1)) fail("sale saleNo unique index is missing");
  else pass("sale saleNo unique index exists");

  return allOk;
}

export async function runVerify() {
  let connected = false;
  try {
    console.log("Connecting to MongoDB...");
    await connectDB();
    connected = true;
    let countsOk = true;
    for (const { label, model, minimum } of MODELS) {
      const count = await model.countDocuments();
      const matches = count >= minimum;
      if (!matches) countsOk = false;
      console.log(`${label.padEnd(21)} ${String(count).padStart(4)} documents in ${model.collection.name.padEnd(24)} (minimum ${minimum}) ${matches ? "OK" : "FAIL"}`);
    }
    const integrityOk = await verify();
    if (countsOk && integrityOk) {
      console.log("\nDatabase verification: PASS");
    } else {
      console.error("\nDatabase verification: FAIL");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Verification failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (connected) await mongoose.disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith("verifyDb.js")) await runVerify();
