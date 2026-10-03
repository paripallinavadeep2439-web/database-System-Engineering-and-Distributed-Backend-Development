import { getStockByMedicine, withStockMetrics } from "../services/dashboardService.js";
import { getSupplierMetrics } from "../services/supplierService.js";
import { dateRangeFilter, startOfDayUtc } from "../utils/dates.js";
import { badRequest } from "../utils/errors.js";
import Batch from "../models/Batch.js";
import Medicine from "../models/Medicine.js";
import Purchase from "../models/Purchase.js";
import Sale from "../models/Sale.js";
import { ok } from "../utils/http.js";
import { round2, serializeBatch, serializeMedicine, serializePurchase, serializeSale } from "../utils/serializers.js";

const REPORT_TYPES = new Set(["inventory", "sales", "purchase", "expiry", "low-stock", "supplier"]);

const EXPIRY_HORIZON_DAYS = 60;

export async function report(req, res) {
  const type = String(req.query.type || "inventory").toLowerCase();
  if (!REPORT_TYPES.has(type)) throw badRequest("Unsupported report type");

  if (type === "inventory") {
    // Stock, average cost and stock value are all calculated on the server from
    // Batch.quantity x Batch.costPerUnit so the report, the CSV export and the
    // printed output can never disagree with the database.
    const [medicines, stock] = await Promise.all([Medicine.find().sort({ name: 1 }).lean(), getStockByMedicine()]);
    const rows = withStockMetrics(medicines, stock);
    return ok(res, rows.map((medicine) => serializeMedicine(medicine, medicine.stock)));
  }

  if (type === "sales") {
    const filter = dateRangeFilter(req.query);
    if (req.query.status && req.query.status !== "All") filter.status = req.query.status;
    const rows = await Sale.find(filter)
      .populate("medicine", "name")
      .populate("batch", "batchNo")
      .sort({ date: -1 })
      .limit(1000)
      .lean();
    return ok(res, rows.map((row) => serializeSale(row)));
  }

  if (type === "purchase") {
    const filter = dateRangeFilter(req.query);
    if (req.query.status && req.query.status !== "All") filter.status = req.query.status;
    const rows = await Purchase.find(filter)
      .populate("supplier", "name")
      .populate("medicine", "name")
      .populate("batch", "batchNo")
      .sort({ date: -1 })
      .limit(1000)
      .lean();
    return ok(res, rows.map((row) => serializePurchase(row)));
  }

  if (type === "expiry") {
    const today = startOfDayUtc();
    const horizon = new Date(today.getTime() + EXPIRY_HORIZON_DAYS * 86400000);
    const rows = await Batch.find({ expiryDate: { $lte: horizon }, quantity: { $gt: 0 } })
      .populate("medicine", "name")
      .populate("supplier", "name")
      .sort({ expiryDate: 1 })
      .lean();
    return ok(
      res,
      rows.map((row) => ({
        ...serializeBatch(row),
        stockValueAtCost: round2(row.quantity * row.costPerUnit),
        potentialLossAtSellingPrice: round2(row.quantity * (row.medicine?.unitPrice || 0)),
      }))
    );
  }

  if (type === "low-stock") {
    const [medicines, stock] = await Promise.all([Medicine.find().sort({ name: 1 }).lean(), getStockByMedicine()]);
    const rows = withStockMetrics(medicines, stock)
      .map((medicine) => serializeMedicine(medicine, medicine.stock))
      .filter((medicine) => medicine.stock < medicine.reorderLevel)
      .map((medicine) => ({
        ...medicine,
        shortage: medicine.reorderLevel - medicine.stock,
        suggestedOrderQuantity: Math.max(medicine.reorderLevel * 2 - medicine.stock, medicine.reorderLevel),
        severity: medicine.reorderLevel > 0 && medicine.stock < medicine.reorderLevel * 0.5 ? "Critical" : "Warning",
      }));
    return ok(res, rows);
  }

  const suppliers = await getSupplierMetrics();
  return ok(res, suppliers);
}
