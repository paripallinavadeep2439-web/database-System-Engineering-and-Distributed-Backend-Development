import Purchase from "../models/Purchase.js";
import Medicine from "../models/Medicine.js";
import Supplier from "../models/Supplier.js";
import Sale from "../models/Sale.js";
import InventoryAdjustment from "../models/InventoryAdjustment.js";
import { auditDocument } from "../middleware/audit.js";
import { adjustInventory, recordPurchase, recordSale, refundSale } from "../services/transactionService.js";
import { dateRangeFilter } from "../utils/dates.js";
import { notFound } from "../utils/errors.js";
import { created, ok, pageMeta, parsePaging } from "../utils/http.js";
import { serializeAdjustment, serializePurchase, serializeSale } from "../utils/serializers.js";
import { optionalString } from "../utils/validation.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dateFilter(query) {
  return dateRangeFilter(query);
}

export async function listPurchases(req, res) {
  const { page, limit, skip } = parsePaging(req.query, 100, 100);
  const filter = dateFilter(req.query);
  if (req.query.status && req.query.status !== "All") filter.status = req.query.status;
  if (req.query.supplierId) filter.supplier = req.query.supplierId;
  if (req.query.medicineId) filter.medicine = req.query.medicineId;
  if (req.query.search) {
    const expression = new RegExp(escapeRegex(req.query.search), "i");
    const [matchingMedicines, matchingSuppliers] = await Promise.all([
      Medicine.find({ $or: [{ name: expression }, { generic: expression }] }).select("_id").lean(),
      Supplier.find({ $or: [{ name: expression }, { contact: expression }] }).select("_id").lean(),
    ]);
    filter.$or = [
      { purchaseNo: expression },
      { medicine: { $in: matchingMedicines.map((medicine) => medicine._id) } },
      { supplier: { $in: matchingSuppliers.map((supplier) => supplier._id) } },
    ];
  }
  const [total, rows] = await Promise.all([
    Purchase.countDocuments(filter),
    Purchase.find(filter).populate("supplier", "name").populate("medicine", "name").populate("batch", "batchNo").sort({ date: -1 }).skip(skip).limit(limit),
  ]);
  return ok(res, rows.map((row) => serializePurchase(row)), pageMeta(total, page, limit));
}

export async function getPurchase(req, res) {
  const row = await Purchase.findById(req.params.id).populate("supplier", "name").populate("medicine", "name").populate("batch", "batchNo");
  if (!row) throw notFound("Purchase not found");
  return ok(res, serializePurchase(row));
}

// The four stock mutations below hand the service a builder instead of writing
// the audit row here. `auditDocument` captures the actor, IP and user agent from
// the request up front; the service calls the builder with the document the
// transaction just wrote and inserts the row on the same session, so the audit
// entry and the stock movement share one commit. Writing it after the transaction
// returned left a window in which stock had moved and the trail did not yet say so.
export async function createPurchase(req, res) {
  const row = await recordPurchase(req.body, req.user._id, (purchase) => auditDocument(req, {
    action: "PURCHASE_CREATE",
    entityType: "Purchase",
    entityId: purchase._id,
    metadata: { purchaseNo: purchase.purchaseNo, quantity: purchase.quantity, total: purchase.total },
  }));
  const populated = await Purchase.findById(row._id).populate("supplier", "name").populate("medicine", "name").populate("batch", "batchNo");
  return created(res, serializePurchase(populated));
}

export async function listSales(req, res) {
  const { page, limit, skip } = parsePaging(req.query, 100, 100);
  const filter = dateFilter(req.query);
  if (req.query.status && req.query.status !== "All") filter.status = req.query.status;
  if (req.query.medicineId) filter.medicine = req.query.medicineId;
  if (req.query.search) {
    const expression = new RegExp(escapeRegex(req.query.search), "i");
    const matchingMedicines = await Medicine.find({ $or: [{ name: expression }, { generic: expression }] }).select("_id").lean();
    filter.$or = [
      { saleNo: expression },
      { customer: expression },
      { medicine: { $in: matchingMedicines.map((medicine) => medicine._id) } },
    ];
  }
  const [total, rows] = await Promise.all([
    Sale.countDocuments(filter),
    Sale.find(filter).populate("medicine", "name").populate("batch", "batchNo").sort({ date: -1 }).skip(skip).limit(limit),
  ]);
  return ok(res, rows.map((row) => serializeSale(row)), pageMeta(total, page, limit));
}

export async function getSale(req, res) {
  const row = await Sale.findById(req.params.id).populate("medicine", "name").populate("batch", "batchNo");
  if (!row) throw notFound("Sale not found");
  return ok(res, serializeSale(row));
}

export async function createSale(req, res) {
  const row = await recordSale(req.body, req.user._id, (sale) => auditDocument(req, {
    action: "SALE_CREATE",
    entityType: "Sale",
    entityId: sale._id,
    metadata: { saleNo: sale.saleNo, quantity: sale.quantity, total: sale.total },
  }));
  const populated = await Sale.findById(row._id).populate("medicine", "name").populate("batch", "batchNo");
  return created(res, serializeSale(populated));
}

export async function refundSaleController(req, res) {
  const reason = optionalString(req.body.reason, "reason", { max: 240 });
  const row = await refundSale(req.params.id, req.user._id, (sale) => auditDocument(req, {
    action: "SALE_REFUND",
    entityType: "Sale",
    entityId: sale._id,
    metadata: { saleNo: sale.saleNo, quantity: sale.quantity, reason: reason || "" },
  }));
  const populated = await Sale.findById(row._id).populate("medicine", "name").populate("batch", "batchNo").populate("createdBy", "name role");
  return ok(res, serializeSale(populated));
}

export async function adjustInventoryController(req, res) {
  const row = await adjustInventory(req.body, req.user._id, (adjustment) => auditDocument(req, {
    action: "INVENTORY_ADJUSTMENT",
    entityType: "InventoryAdjustment",
    entityId: adjustment._id,
    metadata: { quantityDelta: adjustment.quantityDelta, reason: adjustment.reason },
  }));
  const populated = await InventoryAdjustment.findById(row._id).populate("medicine", "name").populate("batch", "batchNo").populate("createdBy", "name role");
  return created(res, serializeAdjustment(populated));
}

export async function listAdjustments(req, res) {
  const { page, limit, skip } = parsePaging(req.query, 50, 100);
  const filter = {};
  if (req.query.medicineId) filter.medicine = req.query.medicineId;
  if (req.query.batchId) filter.batch = req.query.batchId;
  const [total, rows] = await Promise.all([
    InventoryAdjustment.countDocuments(filter),
    InventoryAdjustment.find(filter)
      .populate("medicine", "name")
      .populate("batch", "batchNo")
      .populate("createdBy", "name role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);
  return ok(res, rows.map(serializeAdjustment), pageMeta(total, page, limit));
}
