import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../config/db.js";
import { startOfDayUtc } from "../utils/dates.js";
import { sortFefoBatches } from "../services/transactionService.js";
import User from "../models/User.js";
import Medicine from "../models/Medicine.js";
import Supplier from "../models/Supplier.js";
import Batch from "../models/Batch.js";
import Purchase from "../models/Purchase.js";
import Sale from "../models/Sale.js";
import InventoryAdjustment from "../models/InventoryAdjustment.js";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";

// ---------------------------------------------------------------------------
// DEVELOPMENT SEED SCRIPT — DEVELOPMENT / DEMO DATA ONLY.
//
// Design rule: `Batch.quantity` is never invented. The script replays a ledger of
// purchases, sales, refunds and adjustments in chronological order, exactly the
// way the API would, and derives each batch's final quantity from that ledger.
// `verifyDb.js` then re-derives the same invariant from the stored documents, so
// the seed cannot drift away from the invariant it claims to satisfy.
//
// Every quantity, cost and date is derived from `SEED_DAY` (default: today), so
// the dataset always contains live near-expiry, expired, low-stock and healthy
// batches regardless of when it is run.
//
// Idempotent: it clears the seed collections, then re-inserts. Passwords are
// stored as bcrypt hashes, never plaintext.
// ---------------------------------------------------------------------------

const COLLECTIONS = [
  "users",
  "medicines",
  "suppliers",
  "batches",
  "purchases",
  "sales",
  "inventoryadjustments",
  "notifications",
  "auditlogs",
];

// Deterministic PRNG so a reseed produces the same demo dataset and reviewers can
// reproduce any reported number.
function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(Number(process.env.SEED_RANDOM_SEED || 20260930));
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => Math.floor(random() * (max - min + 1)) + min;

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function addDays(base, days) {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

// SEED_DAY is anchored to UTC midnight so expiry arithmetic matches the server's
// own day boundaries.
const SEED_DAY = startOfDayUtc(process.env.SEED_DAY || new Date());

async function clearCollections() {
  for (const collection of COLLECTIONS) {
    await mongoose.connection.db.collection(collection).deleteMany({});
  }
  console.log(`Cleared ${COLLECTIONS.length} seed collections`);
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const USER_SEED = [
  { name: "Karkala Shiva Reddy", email: "karkala@pharmastock.in", role: "Admin", phone: "+91 99999 00001", status: "Active", joinedDays: -320 },
  { name: "Paripalli Navadeep", email: "navadeep@pharmastock.in", role: "Inventory Manager", phone: "+91 99999 00002", status: "Active", joinedDays: -280 },
  { name: "Dr. R. Sateesh Kumar", email: "sateesh@pharmastock.in", role: "Viewer", phone: "+91 99999 00003", status: "Active", joinedDays: -260 },
  { name: "Priya Nair", email: "priya@pharmastock.in", role: "Pharmacist", phone: "+91 99999 00004", status: "Active", joinedDays: -240 },
  { name: "Arjun Reddi", email: "arjun@pharmastock.in", role: "Sales Staff", phone: "+91 99999 00005", status: "Inactive", joinedDays: -200 },
  { name: "PharmaStock Admin", email: "admin@pharmastock.in", role: "Admin", phone: "+91 99999 00000", status: "Active", joinedDays: -350 },
  { name: "Sneha Iyer", email: "sneha@pharmastock.in", role: "Sales Staff", phone: "+91 99999 00006", status: "Active", joinedDays: -150 },
];

const SUPPLIER_SEED = [
  { name: "MediCore Distributors", contact: "Rahul Sharma", email: "sales@medicore.in", phone: "+91 98120 11442", status: "Active" },
  { name: "PharmaLink Trading", contact: "Anita Desai", email: "orders@pharmalink.in", phone: "+91 99870 23551", status: "Active" },
  { name: "HealthBridge Supplies", contact: "Karan Mehta", email: "contact@healthbridge.in", phone: "+91 99200 88473", status: "Active" },
  { name: "MedAxis Pharma", contact: "Sneha Rao", email: "info@medaxis.in", phone: "+91 98450 66238", status: "On Hold" },
  { name: "GlobalMed Traders", contact: "Vikram Singh", email: "buy@globalmed.in", phone: "+91 97690 77120", status: "Active" },
  { name: "Sanjeevani Cold Chain", contact: "Divya Rao", email: "coldchain@sanjeevani.in", phone: "+91 94440 33117", status: "Active" },
];

// name, generic, category, manufacturer, dosage, unitPrice, reorderLevel, marginPercent
const MEDICINE_SEED = [
  ["Paracetamol 500mg", "Acetaminophen", "Analgesics", "Sun Pharma", "500 mg tab", 2.4, 200, 28],
  ["Paracetamol 650mg", "Acetaminophen", "Analgesics", "Cipla", "650 mg tab", 3.6, 180, 30],
  ["Ibuprofen 400mg", "Ibuprofen", "Analgesics", "Dr. Reddy's", "400 mg tab", 5.2, 160, 32],
  ["Diclofenac 50mg", "Diclofenac Sodium", "Analgesics", "Novartis", "50 mg tab", 2.2, 170, 26],
  ["Aspirin 75mg", "Acetylsalicylic Acid", "Cardiovascular", "Bayer", "75 mg tab", 1.4, 200, 24],
  ["Azithromycin 500mg", "Azithromycin", "Antibiotics", "Cipla", "500 mg tab", 21.5, 150, 34],
  ["Amoxicillin 500mg", "Amoxicillin", "Antibiotics", "Cadila", "500 mg cap", 9.8, 180, 32],
  ["Ciprofloxacin 500mg", "Ciprofloxacin", "Antibiotics", "Cipla", "500 mg tab", 12.4, 140, 33],
  ["Doxycycline 100mg", "Doxycycline", "Antibiotics", "Sun Pharma", "100 mg cap", 8.9, 130, 31],
  ["Metformin 500mg", "Metformin HCl", "Diabetes", "USV", "500 mg tab", 3.2, 220, 27],
  ["Metformin 1000mg", "Metformin HCl", "Diabetes", "USV", "1000 mg tab", 5.6, 200, 29],
  ["Glimepiride 1mg", "Glimepiride", "Diabetes", "Glenmark", "1 mg tab", 6.8, 150, 30],
  ["Atorvastatin 20mg", "Atorvastatin Calcium", "Cardiovascular", "Lupin", "20 mg tab", 12.0, 140, 33],
  ["Amlodipine 5mg", "Amlodipine Besylate", "Cardiovascular", "Torrent", "5 mg tab", 4.6, 180, 28],
  ["Losartan 50mg", "Losartan Potassium", "Cardiovascular", "Macleods", "50 mg tab", 7.5, 150, 30],
  ["Ramipril 5mg", "Ramipril", "Cardiovascular", "Alembic", "5 mg tab", 6.1, 140, 31],
  ["Pantoprazole 40mg", "Pantoprazole Sodium", "Gastrointestinal", "Alkem", "40 mg tab", 8.5, 160, 32],
  ["Omeprazole 20mg", "Omeprazole", "Gastrointestinal", "Ranbaxy", "20 mg cap", 5.4, 170, 29],
  ["Ondansetron 4mg", "Ondansetron", "Gastrointestinal", "Sun Pharma", "4 mg tab", 9.2, 120, 35],
  ["Cetirizine 10mg", "Cetirizine HCl", "Antihistamine", "Dr. Reddy's", "10 mg tab", 1.9, 200, 26],
  ["Levocetirizine 5mg", "Levocetirizine", "Antihistamine", "Cipla", "5 mg tab", 3.2, 160, 28],
  ["Loratadine 10mg", "Loratadine", "Antihistamine", "Alkem", "10 mg tab", 2.6, 150, 27],
  ["Ambroxol 30mg", "Ambroxol HCl", "Respiratory", "Mankind", "30 mg tab", 3.5, 150, 29],
  ["Montelukast 10mg", "Montelukast", "Respiratory", "MSD", "10 mg tab", 15.5, 110, 34],
  ["Salbutamol Inhaler", "Salbutamol", "Respiratory", "Cipla", "100 mcg puff", 148.0, 70, 32],
  ["Vitamin D3 60k IU", "Cholecalciferol", "Vitamins & Supplements", "Zuventus", "60k IU tab", 18.0, 120, 31],
  ["Vitamin B12", "Cyanocobalamin", "Vitamins & Supplements", "USV", "500 mcg tab", 7.4, 130, 30],
  ["Ferrous Sulphate", "Ferrous Sulphate", "Vitamins & Supplements", "Mankind", "325 mg tab", 2.1, 190, 27],
  ["Calcium Carbonate", "Calcium Carbonate", "Vitamins & Supplements", "Shilpa Medicare", "500 mg tab", 3.9, 160, 28],
  ["Insulin Glargine 100IU", "Insulin Glargine", "Diabetes", "Sanofi", "3 mL pen", 540.0, 60, 24],
  ["Betamethasone Cream", "Betamethasone", "Dermatological", "Sun Pharma", "0.1% 20 g", 34.0, 90, 33],
  ["Clotrimazole Cream", "Clotrimazole", "Dermatological", "Pravin", "1% 20 g", 22.5, 90, 30],
  ["Levocetirizine Syrup", "Levocetirizine", "Antihistamine", "Mankind", "5 mg/5 mL", 41.0, 60, 32],
  ["Sertraline 50mg", "Sertraline", "Neurology", "Intas", "50 mg tab", 16.4, 100, 34],
];

// Expiry offsets in days from SEED_DAY. The mix guarantees the dashboard and the
// expiry report always have expired, critical, near-expiry and healthy batches.
const EXPIRY_PLAN = [
  { count: 2, offsets: [-42, -8] },   // already expired
  { count: 4, offsets: [5, 12, 21, 29] }, // critical / near expiry
  { count: 8, offsets: [75, 110, 150, 190, 240, 300, 340, 380] }, // healthy
];

function planBatchesFor(medicineIndex) {
  const tier = medicineIndex % 5;
  if (tier === 0) return EXPIRY_PLAN[0].offsets;
  if (tier === 1) return EXPIRY_PLAN[1].offsets.slice(0, 1 + (medicineIndex % 2));
  if (tier === 2) return EXPIRY_PLAN[2].offsets.slice(0, 3);
  return [EXPIRY_PLAN[1].offsets[medicineIndex % 4], EXPIRY_PLAN[2].offsets[medicineIndex % 8]];
}

const CUSTOMERS = ["City Meds", "LifeCare Pharmacy", "Apollo Retail", "Wellness Plus", "CarePoint Distributors", "Sunrise Medicals", "Walk-in"];

async function seedCore() {
  const commonPassword = process.env.SEED_PASSWORD;
  if (!commonPassword || commonPassword.length < 8) {
    throw new Error("SEED_PASSWORD must be set to a value of at least 8 characters");
  }
  const hash = await bcrypt.hash(commonPassword, 10);

  const users = await User.insertMany(
    USER_SEED.map((entry) => ({
      name: entry.name,
      email: entry.email,
      password: hash,
      role: entry.role,
      phone: entry.phone,
      status: entry.status,
      joined: addDays(SEED_DAY, entry.joinedDays),
    }))
  );
  const admin = users.find((user) => user.role === "Admin" && user.email === "admin@pharmastock.in");
  const inventoryManager = users.find((user) => user.role === "Inventory Manager");
  const pharmacists = users.filter((user) => user.role === "Pharmacist");
  const salesStaff = users.filter((user) => user.role === "Sales Staff" && user.status === "Active");
  const stockActors = [admin, inventoryManager, ...pharmacists];
  console.log(`Users: ${users.length} inserted`);

  const suppliers = await Supplier.insertMany(SUPPLIER_SEED);
  const activeSuppliers = suppliers.filter((supplier) => supplier.status === "Active");
  console.log(`Suppliers: ${suppliers.length} inserted`);

  const medicines = await Medicine.insertMany(
    MEDICINE_SEED.map(([name, generic, category, manufacturer, dosage, unitPrice, reorderLevel]) => ({
      name,
      generic,
      category,
      manufacturer,
      dosage,
      unitPrice,
      reorderLevel,
    }))
  );
  // Lookup maps are built once instead of scanning arrays inside the ledger
  // replay, which also makes it impossible for a lookup to return undefined
  // mid-run if an array is re-read after a document is replaced.
  const medicineById = new Map(medicines.map((medicine) => [String(medicine._id), medicine]));
  console.log(`Medicines: ${medicines.length} inserted`);

  // -------------------------------------------------------------------------
  // Batches: created empty, then filled exclusively by purchases below, which is
  // exactly how the API behaves after the POST /batches hardening.
  // -------------------------------------------------------------------------
  const batchPlans = [];
  medicines.forEach((medicine, medicineIndex) => {
    const offsets = planBatchesFor(medicineIndex);
    offsets.forEach((expiryOffset, batchIndex) => {
      const shelfLifeDays = between(365, 730);
      const supplier = pick(activeSuppliers);
      batchPlans.push({
        batchNo: `${medicine.name.split(" ")[0].slice(0, 3).toUpperCase()}-${4200 + medicineIndex * 4 + batchIndex}`,
        // Explicit ids rather than whole documents, so the ledger lookups below
        // always compare ObjectIds to ObjectIds.
        medicine: medicine._id,
        supplier: supplier._id,
        manufactureDate: addDays(SEED_DAY, expiryOffset - shelfLifeDays),
        expiryDate: addDays(SEED_DAY, expiryOffset),
        quantity: 0,
        costPerUnit: 0,
      });
    });
  });
  const batches = await Batch.insertMany(batchPlans);
  const batchById = new Map(batches.map((batch) => [String(batch._id), batch]));
  const supplierById = new Map(suppliers.map((supplier) => [String(supplier._id), supplier]));
  const userById = new Map(users.map((user) => [String(user._id), user]));
  console.log(`Batches: ${batches.length} inserted (all created at quantity 0)`);

  // Mutable running state, mirroring what the API would hold in a session.
  const purchaseDocs = [];
  const purchaseDateByBatchId = new Map();
  const saleDocs = [];
  const adjustmentDocs = [];
  const notificationDocs = [];
  let purchaseSequence = 1000;
  let saleSequence = 5000;

  // -------------------------------------------------------------------------
  // Purchases. Each batch is restocked between 120 and 60 days before expiry, so
  // every batch holds a positive quantity before any sale consumes it.
  // -------------------------------------------------------------------------
  for (const batch of batches) {
    const medicine = medicineById.get(String(batch.medicine));
    if (!medicine) throw new Error(`Medicine missing for batch ${batch.batchNo}`);
    // Cost is 72-88% of the selling price, giving a realistic gross margin.
    const costFactor = 0.72 + random() * 0.16;
    const unitCost = roundMoney(medicine.unitPrice * costFactor);
    const received = Math.max(medicine.reorderLevel, between(60, 420));
    // Received somewhere in the recent past rather than relative to the expiry
    // date. Deriving it from expiry made near-expiry batches arrive "today",
    // which collapsed almost every sale onto a single day and left the sales
    // reports and monthly trend with nothing to show.
    const purchaseDate = addDays(SEED_DAY, -between(10, 170));
    // A purchase cannot predate manufacture or postdate today.
    const date = purchaseDate < batch.manufactureDate ? batch.manufactureDate : purchaseDate;
    const statusRoll = random();
    const status = statusRoll > 0.78 ? "Pending" : statusRoll > 0.62 ? "Partially Paid" : "Paid";
    const total = roundMoney(received * unitCost);
    const paidAmount = status === "Paid" ? total : status === "Partially Paid" ? roundMoney(total * 0.5) : 0;
    purchaseDocs.push({
      purchaseNo: `PO-${SEED_DAY.getUTCFullYear()}-${purchaseSequence++}`,
      supplier: batch.supplier,
      medicine: batch.medicine,
      batch: batch._id,
      quantity: received,
      unitCost,
      total,
      paidAmount,
      date,
      status,
      notes: "",
      createdBy: pick(stockActors)._id,
    });
    // Weighted-average cost: a single purchase into a zero-quantity batch means the
    // weighted average is simply that purchase's unit cost.
    batch.costPerUnit = unitCost;
    batch.quantity += received;
    // Remembered so a sale can never be dated before the stock it consumed.
    purchaseDateByBatchId.set(String(batch._id), date);
  }
  const purchases = await Purchase.insertMany(purchaseDocs);
  console.log(`Purchases: ${purchases.length} inserted`);

  // -------------------------------------------------------------------------
  // Sales, allocated FEFO across every unexpired batch of the medicine using the
  // same ordering the transaction service uses. Allocation snapshots capture the
  // cost at the time of sale, which is what COGS reporting reads.
  // -------------------------------------------------------------------------
  const saleActors = [admin, inventoryManager, ...pharmacists, ...salesStaff];
  const SALE_ATTEMPTS = 140;
  for (let i = 0; i < SALE_ATTEMPTS; i += 1) {
    const medicine = pick(medicines);
    const sellable = sortFefoBatches(
      batches.filter(
        (batch) =>
          String(batch.medicine) === String(medicine._id) &&
          batch.quantity > 0 &&
          batch.expiryDate > SEED_DAY
      )
    );
    if (!sellable.length) continue;
    let remaining = between(2, 60);
    const allocations = [];
    for (const batch of sellable) {
      if (remaining <= 0) break;
      // Never allocate more than the batch holds, and never allocate the last
      // unit of every batch, so the dataset keeps some depleted batches too.
      const take = Math.min(remaining, Math.max(0, batch.quantity - (random() > 0.75 ? 1 : 0)));
      if (take <= 0) continue;
      allocations.push({ batch: batch._id, batchNo: batch.batchNo, quantity: take, unitCost: batch.costPerUnit });
      batch.quantity -= take;
      remaining -= take;
    }
    if (!allocations.length || remaining > 0) continue;
    // The sale date is chosen AFTER allocation, and never earlier than the LAST
    // purchase that supplied the allocated stock. Random date ranges alone
    // produced sales dated before the batch existed, which the ledger verifier
    // now rejects. The accumulator starts far in the past so the first allocation
    // always wins the comparison; seeding it with today silently pinned every
    // sale to the current date.
    const latestReceived = allocations.reduce((latest, allocation) => {
      const received = purchaseDateByBatchId.get(String(allocation.batch));
      return received && received > latest ? received : latest;
    }, addDays(SEED_DAY, -3650));
    const spanDays = Math.max(0, Math.round((SEED_DAY - latestReceived) / 86400000));
    const date = addDays(latestReceived, between(0, spanDays));
    const quantity = allocations.reduce((total, allocation) => total + allocation.quantity, 0);
    saleDocs.push({
      saleNo: `INV-${SEED_DAY.getUTCFullYear()}-${saleSequence++}`,
      medicine: medicine._id,
      batch: allocations[0].batch,
      allocations,
      quantity,
      unitPrice: medicine.unitPrice,
      total: roundMoney(quantity * medicine.unitPrice),
      customer: pick(CUSTOMERS),
      date,
      status: "Completed",
      notes: "",
      createdBy: pick(saleActors)._id,
    });
  }
  // -------------------------------------------------------------------------
  // Refunds, applied before the insert so the status and refundedAt fields are
  // stored once rather than mutated afterwards. A refund returns the exact units
  // to the exact batches that supplied them, the same compensation rule the
  // refund endpoint applies.
  // -------------------------------------------------------------------------
  const refundCandidates = saleDocs.filter((sale) => sale.date < addDays(SEED_DAY, -20));
  const refundCount = Math.min(4, refundCandidates.length);
  for (let i = 0; i < refundCount; i += 1) {
    const sale = refundCandidates[Math.floor((i * refundCandidates.length) / (refundCount + 1))];
    if (!sale) continue;
    for (const allocation of sale.allocations) {
      const batch = batchById.get(String(allocation.batch));
      if (batch) batch.quantity += allocation.quantity;
    }
    sale.status = "Refunded";
    sale.refundedAt = addDays(sale.date, between(1, 5));
  }

  const sales = await Sale.insertMany(saleDocs);
  console.log(`Sales: ${sales.length} inserted (${refundCount} refunded)`);

  // -------------------------------------------------------------------------
  // Adjustments: expiry write-offs and damage. These are the only way stock leaves
  // without a sale, and each row records the before/after quantity.
  // -------------------------------------------------------------------------
  const expiredBatches = batches.filter((batch) => batch.expiryDate <= SEED_DAY && batch.quantity > 0);
  for (const batch of expiredBatches) {
    const before = batch.quantity;
    batch.quantity = 0;
    adjustmentDocs.push({
      medicine: batch.medicine,
      batch: batch._id,
      quantityDelta: -before,
      quantityBefore: before,
      quantityAfter: 0,
      reason: "Expired stock write-off",
      note: `Batch ${batch.batchNo} reached its expiry date.`,
      createdBy: pick(stockActors)._id,
    });
  }
  // A couple of damage/loss adjustments on healthy batches.
  for (const batch of pickHealthyDamageTargets(batches)) {
    const loss = Math.min(batch.quantity, between(1, 6));
    if (loss <= 0) continue;
    const before = batch.quantity;
    batch.quantity -= loss;
    adjustmentDocs.push({
      medicine: batch.medicine,
      batch: batch._id,
      quantityDelta: -loss,
      quantityBefore: before,
      quantityAfter: batch.quantity,
      reason: pick(["Damaged in storage", "Breakage reported during audit", "Short count correction"]),
      note: `Physical count variance on batch ${batch.batchNo}.`,
      createdBy: pick(stockActors)._id,
    });
  }
  // One positive correction so both adjustment directions are represented.
  const restockBatch = batches.find((batch) => batch.quantity > 0 && batch.expiryDate > SEED_DAY);
  if (restockBatch) {
    const gain = between(4, 18);
    const before = restockBatch.quantity;
    restockBatch.quantity += gain;
    adjustmentDocs.push({
      medicine: restockBatch.medicine,
      batch: restockBatch._id,
      quantityDelta: gain,
      quantityBefore: before,
      quantityAfter: restockBatch.quantity,
      reason: "Found stock during physical audit",
      note: `Unrecorded units located during the stock count of ${restockBatch.batchNo}.`,
      createdBy: pick(stockActors)._id,
    });
  }
  if (adjustmentDocs.length) {
    await InventoryAdjustment.insertMany(adjustmentDocs);
    console.log(`InventoryAdjustments: ${adjustmentDocs.length} inserted`);
  }

  // Persist the ledger-derived quantities. Nothing else writes Batch.quantity.
  await Promise.all(batches.map((batch) => Batch.updateOne({ _id: batch._id }, { $set: { quantity: batch.quantity, costPerUnit: batch.costPerUnit } })));
  console.log(`Batch quantities reconciled from the ledger (${batches.length} batches)`);

  // -------------------------------------------------------------------------
  // Notifications, derived from the state that was just written.
  // -------------------------------------------------------------------------
  for (const batch of expiredBatches) {
    const medicine = medicineById.get(String(batch.medicine));
    notificationDocs.push({
      type: "expired",
      title: "Batch expired",
      message: `${medicine?.name || "Medicine"} batch ${batch.batchNo} expired and was written off.`,
      entityType: "Batch",
      entityId: batch._id,
      read: false,
    });
  }
  for (const batch of batches.filter((row) => row.quantity > 0 && row.expiryDate > SEED_DAY && (row.expiryDate - SEED_DAY) / 86400000 <= 30)) {
    const medicine = medicineById.get(String(batch.medicine));
    const days = Math.round((batch.expiryDate - SEED_DAY) / 86400000);
    notificationDocs.push({
      type: "expiry",
      title: "Batch nearing expiry",
      message: `${medicine?.name || "Medicine"} batch ${batch.batchNo} expires in ${days} day(s).`,
      entityType: "Batch",
      entityId: batch._id,
      read: false,
    });
  }
  const stockByMedicine = new Map();
  for (const batch of batches) {
    if (batch.expiryDate <= SEED_DAY) continue;
    stockByMedicine.set(String(batch.medicine), (stockByMedicine.get(String(batch.medicine)) || 0) + batch.quantity);
  }
  for (const medicine of medicines) {
    const stock = stockByMedicine.get(String(medicine._id)) || 0;
    if (stock < medicine.reorderLevel) {
      notificationDocs.push({
        type: "low",
        title: "Stock below reorder level",
        message: `${medicine.name} has ${stock} unit(s) left against a reorder level of ${medicine.reorderLevel}.`,
        entityType: "Medicine",
        entityId: medicine._id,
        read: false,
      });
    }
  }
  notificationDocs.push({
    type: "system",
    title: "Demo dataset loaded",
    message: `PharmaStock demo data generated for ${SEED_DAY.toISOString().slice(0, 10)}: ${medicines.length} medicines, ${batches.length} batches, ${purchases.length} purchases, ${sales.length} sales.`,
    read: true,
  });
  await Notification.insertMany(notificationDocs);
  console.log(`Notifications: ${notificationDocs.length} inserted`);

  // -------------------------------------------------------------------------
  // AuditLog, so the Admin Audit Log screen has content on first login.
  // -------------------------------------------------------------------------
  const auditDocs = [];
  const audit = (action, entityType, entityId, actor, metadata, daysAgo) => {
    auditDocs.push({
      action,
      entityType,
      entityId,
      actor: actor._id,
      actorEmail: actor.email,
      metadata,
      ipAddress: "127.0.0.1",
      userAgent: "pharmastock-seed",
      createdAt: addDays(SEED_DAY, -daysAgo),
    });
  };
  for (const purchase of purchases.slice(0, 40)) {
    audit("PURCHASE_CREATE", "Purchase", purchase._id, userById.get(String(purchase.createdBy)), { purchaseNo: purchase.purchaseNo, quantity: purchase.quantity }, -Math.max(1, Math.round((SEED_DAY - purchase.date) / 86400000)));
  }
  for (const sale of sales.slice(0, 40)) {
    audit("SALE_CREATE", "Sale", sale._id, userById.get(String(sale.createdBy)), { saleNo: sale.saleNo, quantity: sale.quantity }, -Math.max(1, Math.round((SEED_DAY - sale.date) / 86400000)));
  }
  for (const sale of sales.filter((row) => row.status === "Refunded")) {
    audit("SALE_REFUND", "Sale", sale._id, admin, { saleNo: sale.saleNo }, -Math.max(1, Math.round((SEED_DAY - sale.refundedAt) / 86400000)));
  }
  for (const adjustment of await InventoryAdjustment.find().lean()) {
    audit("INVENTORY_ADJUSTMENT", "InventoryAdjustment", adjustment._id, stockActors[0], { quantityDelta: adjustment.quantityDelta, reason: adjustment.reason }, -1);
  }
  await AuditLog.insertMany(auditDocs);
  console.log(`AuditLogs: ${auditDocs.length} inserted`);

  return { users, medicines, suppliers, batches, purchases, sales, adjustments: adjustmentDocs.length, notifications: notificationDocs.length, auditLogs: auditDocs.length };
}

function pickHealthyDamageTargets(batches) {
  return batches.filter((batch) => batch.quantity > 5 && batch.expiryDate > SEED_DAY).slice(0, 2);
}

export async function runSeed() {
  try {
    if (process.env.SEED_CONFIRM !== "RESET" && !process.argv.includes("--force")) {
      throw new Error("Refusing to clear existing data. Set SEED_CONFIRM=RESET or pass --force explicitly.");
    }
    console.log("Connecting to MongoDB...");
    await connectDB();
    await clearCollections();
    const result = await seedCore();
    console.log("\nSeed complete.");
    console.log("Documents written:");
    console.log(`  users               ${result.users.length}`);
    console.log(`  medicines           ${result.medicines.length}`);
    console.log(`  suppliers           ${result.suppliers.length}`);
    console.log(`  batches             ${result.batches.length}`);
    console.log(`  purchases           ${result.purchases.length}`);
    console.log(`  sales               ${result.sales.length}`);
    console.log(`  inventoryAdjustments${String(result.adjustments).padStart(3)}`);
    console.log(`  notifications       ${result.notifications}`);
    console.log(`  auditLogs           ${result.auditLogs}`);
    console.log("Batch quantities are derived from the purchase/sale/refund/adjustment ledger.");
  } catch (error) {
    console.error("\nSeed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  await runSeed();
}
