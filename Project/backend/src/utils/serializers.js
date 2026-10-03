import { startOfDayUtc } from "./dates.js";

export function initials(name = "User") {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "U";
}

function idOf(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id || value.id) return String(value._id || value.id);
  return String(value);
}

function refName(value, fallback = "Unknown") {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value.name || value.email || fallback;
}

function dateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function batchStatus(batch, now = new Date()) {
  const today = startOfDayUtc(now);
  const expiry = startOfDayUtc(batch.expiryDate);
  if (Number.isNaN(expiry.getTime())) return "Unknown";
  const days = Math.round((expiry - today) / 86400000);
  if (days < 0) return "Expired";
  if (Number(batch.quantity) <= 0) return "Depleted";
  if (days <= 30) return "Near Expiry";
  return "Active";
}

export function daysUntilExpiry(value, now = new Date()) {
  const expiry = startOfDayUtc(value);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.round((expiry - startOfDayUtc(now)) / 86400000);
}

export function serializeUser(user) {
  if (!user) return null;
  return {
    id: idOf(user),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || "",
    status: user.status,
    joined: user.joined || user.createdAt,
    avatar: initials(user.name),
  };
}

export function serializeMedicine(medicine, stock = 0) {
  if (!medicine) return null;
  const units = Number(stock || 0);
  // Inventory value is derived from the batches that actually hold the sellable
  // stock, using each batch's cost. It is never derived from the selling price.
  const stockValue = Number(medicine.stockValue ?? 0);
  return {
    id: idOf(medicine),
    name: medicine.name,
    generic: medicine.generic,
    category: medicine.category,
    manufacturer: medicine.manufacturer,
    dosage: medicine.dosage || "",
    unitPrice: Number(medicine.unitPrice || 0),
    reorderLevel: Number(medicine.reorderLevel || 0),
    stock: units,
    avgCostPerUnit: round2(medicine.avgCostPerUnit ?? 0),
    stockValue: round2(stockValue),
    createdAt: medicine.createdAt,
    updatedAt: medicine.updatedAt,
  };
}

export function serializeSupplier(supplier, metrics = {}) {
  if (!supplier) return null;
  return {
    id: idOf(supplier),
    name: supplier.name,
    contact: supplier.contact,
    email: supplier.email || "",
    phone: supplier.phone || "",
    status: supplier.status,
    medicinesSupplied: Number(metrics.medicinesSupplied || 0),
    purchaseOrders: Number(metrics.purchaseOrders || 0),
    totalPurchased: round2(metrics.totalPurchased || 0),
    outstanding: round2(metrics.outstanding || 0),
    // Payment compliance = share of a supplier's purchase orders that are fully
    // settled. This is a payment metric, not a delivery or quality metric: the
    // schema stores no delivery or quality data, so none is invented.
    paymentCompliance: Number(metrics.paymentCompliance || 0),
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}

export function serializeBatch(batch, references = {}) {
  if (!batch) return null;
  const medicine = references.medicine || batch.medicine;
  const supplier = references.supplier || batch.supplier;
  return {
    id: idOf(batch),
    batchNo: batch.batchNo,
    medicineId: idOf(medicine),
    medicineName: refName(medicine),
    supplierId: idOf(supplier),
    supplierName: refName(supplier),
    manufactureDate: dateOnly(batch.manufactureDate),
    expiryDate: dateOnly(batch.expiryDate),
    quantity: Number(batch.quantity || 0),
    costPerUnit: Number(batch.costPerUnit || 0),
    status: batchStatus(batch),
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

export function serializePurchase(purchase, references = {}) {
  if (!purchase) return null;
  const supplier = references.supplier || purchase.supplier;
  const medicine = references.medicine || purchase.medicine;
  const batch = references.batch || purchase.batch;
  return {
    id: idOf(purchase),
    purchaseNo: purchase.purchaseNo,
    supplierId: idOf(supplier),
    supplier: refName(supplier),
    medicineId: idOf(medicine),
    medicine: refName(medicine),
    batchId: idOf(batch),
    batch: refName(batch, batch?.batchNo || "Unknown"),
    quantity: Number(purchase.quantity || 0),
    unitCost: Number(purchase.unitCost || 0),
    total: Number(purchase.total || 0),
    date: purchase.date,
    status: purchase.status,
    paidAmount: Number(purchase.paidAmount || 0),
    // Outstanding is derived, never stored, so a purchase can never hold a
    // balance that disagrees with its own total and paid amount.
    outstanding: round2(Math.max(0, Number(purchase.total || 0) - Number(purchase.paidAmount || 0))),
    notes: purchase.notes || "",
    createdAt: purchase.createdAt,
  };
}

export function serializeSale(sale, references = {}) {
  if (!sale) return null;
  const medicine = references.medicine || sale.medicine;
  const batch = references.batch || sale.batch;
  const allocations = (sale.allocations || []).map((allocation) => ({
    batchId: idOf(allocation.batch),
    batchNo: allocation.batchNo || refName(allocation.batch, "Unknown"),
    quantity: Number(allocation.quantity || 0),
    unitCost: Number(allocation.unitCost || 0),
  }));
  return {
    id: idOf(sale),
    saleNo: sale.saleNo,
    medicineId: idOf(medicine),
    medicine: refName(medicine),
    batchId: idOf(batch),
    batch: refName(batch, batch?.batchNo || allocations.map((a) => a.batchNo).join(", ") || "Unknown"),
    allocations,
    quantity: Number(sale.quantity || 0),
    unitPrice: Number(sale.unitPrice || 0),
    total: Number(sale.total || 0),
    customer: sale.customer || "Walk-in",
    date: sale.date,
    status: sale.status,
    refundedAt: sale.refundedAt || null,
    costOfGoods: round2(allocations.reduce((total, allocation) => total + allocation.quantity * allocation.unitCost, 0)),
    grossProfit: round2(Number(sale.total || 0) - allocations.reduce((total, allocation) => total + allocation.quantity * allocation.unitCost, 0)),
    notes: sale.notes || "",
    createdAt: sale.createdAt,
  };
}

export function serializeAdjustment(adjustment) {
  if (!adjustment) return null;
  const medicine = adjustment.medicine;
  const batch = adjustment.batch;
  const actor = adjustment.createdBy;
  return {
    id: idOf(adjustment),
    medicineId: idOf(medicine),
    medicine: refName(medicine),
    batchId: idOf(batch),
    batch: refName(batch, batch?.batchNo || "Unknown"),
    quantityDelta: Number(adjustment.quantityDelta || 0),
    quantityBefore: Number(adjustment.quantityBefore || 0),
    quantityAfter: Number(adjustment.quantityAfter || 0),
    direction: Number(adjustment.quantityDelta || 0) > 0 ? "Increase" : "Decrease",
    reason: adjustment.reason,
    note: adjustment.note || "",
    createdBy: actor?._id ? String(actor._id) : String(adjustment.createdBy || ""),
    createdByName: refName(actor, "Unknown"),
    createdAt: adjustment.createdAt,
  };
}

export function serializeNotification(notification) {
  return {
    id: idOf(notification),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    entityType: notification.entityType,
    entityId: notification.entityId ? String(notification.entityId) : null,
    // `read` is a shared review flag on an operational alert, so the reviewer is
    // returned alongside it rather than implying a per-user read receipt.
    read: Boolean(notification.read),
    acknowledgedBy: notification.acknowledgedBy ? String(notification.acknowledgedBy) : null,
    acknowledgedByEmail: notification.acknowledgedByEmail || null,
    acknowledgedAt: notification.acknowledgedAt || null,
    time: notification.createdAt,
    createdAt: notification.createdAt,
  };
}

// Audit metadata is stored as Mixed, so any key that looks credential-shaped is
// stripped before the log is ever returned. The API never echoes a password,
// token or secret to a client.
const SENSITIVE_KEY = /pass(word)?|secret|token|jwt|authorization|api[-_]?key|credential|cookie|session[-_]?id|private[-_]?key/i;

export function redactAuditMetadata(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => redactAuditMetadata(item, depth + 1));
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) {
        result[key] = "[redacted]";
        continue;
      }
      result[key] = redactAuditMetadata(nested, depth + 1);
    }
    return result;
  }
  return value;
}

export function serializeAudit(log) {
  const actor = log.actor;
  return {
    id: idOf(log),
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId ? String(log.entityId) : null,
    actorId: actor?._id ? String(actor._id) : null,
    actor: actor ? { id: String(actor._id), name: actor.name, email: actor.email, role: actor.role } : null,
    actorEmail: log.actorEmail || "",
    metadata: redactAuditMetadata(log.metadata || {}),
    ipAddress: log.ipAddress || "",
    createdAt: log.createdAt,
  };
}
