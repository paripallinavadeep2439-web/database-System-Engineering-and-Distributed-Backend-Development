import Batch from "../models/Batch.js";
import Medicine from "../models/Medicine.js";
import Purchase from "../models/Purchase.js";
import Sale from "../models/Sale.js";
import Supplier from "../models/Supplier.js";
import { startOfDayUtc, resolveDateRange } from "../utils/dates.js";
import { round2 } from "../utils/serializers.js";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// All month bucketing uses UTC so a sale recorded at 23:30 UTC never lands in a
// different bucket than the monthly trend chart that displays it.
function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return `${monthNames[month - 1]} ${year}`;
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

/**
 * Cost of goods sold for a sale, taken from the immutable FEFO allocation
 * snapshot that was written inside the sale transaction. It is never recomputed
 * from the batch's current cost, which can change after the sale.
 */
export function saleCogs(sale) {
  return (sale.allocations || []).reduce(
    (total, allocation) => total + Number(allocation.quantity || 0) * Number(allocation.unitCost || 0),
    0
  );
}

/** Sellable stock only: positive quantity and not yet expired. */
export async function getStockByMedicine(asOf = new Date()) {
  const rows = await Batch.aggregate([
    { $match: { expiryDate: { $gte: startOfDayUtc(asOf) }, quantity: { $gt: 0 } } },
    {
      $group: {
        _id: "$medicine",
        stock: { $sum: "$quantity" },
        // Inventory value uses each batch's own cost, never the selling price.
        value: { $sum: { $multiply: ["$quantity", "$costPerUnit"] } },
        batches: { $sum: 1 },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
}

/** Attaches server-calculated stock, average cost and stock value to medicines. */
export function withStockMetrics(medicines, stockMap) {
  return medicines.map((medicine) => {
    const row = stockMap.get(String(medicine._id));
    const units = row?.stock || 0;
    const value = row?.value || 0;
    return {
      ...medicine,
      stock: units,
      batchCount: row?.batches || 0,
      avgCostPerUnit: units > 0 ? round2(value / units) : 0,
      stockValue: round2(value),
    };
  });
}

export async function getDashboardData() {
  const now = new Date();
  const today = startOfDayUtc(now);
  const [medicines, suppliers, stockRows, activeBatches, sales, purchases] = await Promise.all([
    Medicine.find().lean(),
    Supplier.find().lean(),
    getStockByMedicine(now),
    Batch.find({ expiryDate: { $gte: today }, quantity: { $gt: 0 } })
      .select("batchNo medicine supplier expiryDate quantity costPerUnit")
      .populate("medicine", "name")
      .populate("supplier", "name")
      .lean(),
    Sale.find({ status: "Completed" }).sort({ date: -1 }).limit(5000).lean(),
    Purchase.find().sort({ date: -1 }).limit(5000).lean(),
  ]);
  const stock = new Map();
  for (const medicine of medicines) {
    const row = stockRows.get(String(medicine._id));
    stock.set(String(medicine._id), { quantity: row?.stock || 0, value: row?.value || 0 });
  }
  const totalStockUnits = [...stock.values()].reduce((total, row) => total + row.quantity, 0);
  const inventoryValue = [...stock.values()].reduce((total, row) => total + row.value, 0);
  const lowStock = medicines.filter((medicine) => (stock.get(String(medicine._id))?.quantity || 0) < medicine.reorderLevel);
  const daysUntil = (value) => Math.round((startOfDayUtc(value) - today) / 86400000);
  const nearExpiry = activeBatches.filter((batch) => {
    const days = daysUntil(batch.expiryDate);
    return days >= 0 && days <= 30;
  });
  const currentMonth = monthKey(now);
  const monthlySales = sales.filter((sale) => monthKey(new Date(sale.date)) === currentMonth);
  const monthlySalesValue = sum(monthlySales, "total");
  const salesByMonth = new Map();
  const purchaseByMonth = new Map();
  for (const sale of sales) {
    const key = monthKey(new Date(sale.date));
    salesByMonth.set(key, (salesByMonth.get(key) || 0) + Number(sale.total || 0));
  }
  for (const purchase of purchases) {
    const key = monthKey(new Date(purchase.date));
    purchaseByMonth.set(key, (purchaseByMonth.get(key) || 0) + Number(purchase.total || 0));
  }
  const trend = [...new Set([...salesByMonth.keys(), ...purchaseByMonth.keys()])]
    .sort()
    .slice(-12)
    .map((key) => ({
      month: monthLabel(key),
      sales: round2(salesByMonth.get(key) || 0),
      purchases: round2(purchaseByMonth.get(key) || 0),
    }));
  const categoryMap = new Map();
  for (const medicine of medicines) {
    const quantity = stock.get(String(medicine._id))?.quantity || 0;
    if (quantity > 0) categoryMap.set(medicine.category, (categoryMap.get(medicine.category) || 0) + quantity);
  }
  const category = [...categoryMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const buckets = [
    { range: "0–7 days", max: 7 },
    { range: "8–15 days", max: 15 },
    { range: "16–30 days", max: 30 },
    { range: "31–60 days", max: 60 },
    { range: "60+ days", max: Infinity },
  ];
  const expiryTimeline = buckets.map((bucket) => ({ range: bucket.range, count: 0 }));
  for (const batch of activeBatches) {
    const days = daysUntil(batch.expiryDate);
    const index = buckets.findIndex((bucket) => days <= bucket.max);
    expiryTimeline[index === -1 ? buckets.length - 1 : index].count += 1;
  }
  const healthy = medicines.filter((medicine) => (stock.get(String(medicine._id))?.quantity || 0) >= medicine.reorderLevel).length;
  const critical = medicines.filter((medicine) => {
    const quantity = stock.get(String(medicine._id))?.quantity || 0;
    return medicine.reorderLevel > 0 && quantity < medicine.reorderLevel * 0.5;
  }).length;
  const low = lowStock.length - critical;
  return {
    kpis: {
      totalMedicines: { value: medicines.length, delta: "Current catalogue", trend: "neutral", label: "medicines" },
      totalStockUnits: { value: totalStockUnits, delta: "Sellable units", trend: "neutral", label: "across active batches" },
      lowStock: { value: lowStock.length, delta: "Needs attention", trend: "neutral", label: "below reorder level" },
      nearExpiry: { value: nearExpiry.length, delta: "Within 30 days", trend: "neutral", label: "batches expiring" },
      inventoryValue: { value: round2(inventoryValue), delta: "Current cost value", trend: "neutral", label: "active stock" },
      monthlySales: { value: round2(monthlySalesValue), delta: "Current month", trend: "neutral", label: "completed sales" },
    },
    salesTrend: trend,
    category,
    stockHealth: { healthy, lowStock: low, critical, expired: await Batch.countDocuments({ expiryDate: { $lt: today } }) },
    expiryTimeline,
    lowStockAlerts: lowStock
      .map((medicine) => {
        const quantity = stock.get(String(medicine._id))?.quantity || 0;
        return {
          id: String(medicine._id),
          name: medicine.name,
          generic: medicine.generic,
          stock: quantity,
          reorderLevel: medicine.reorderLevel,
          severity: quantity < medicine.reorderLevel * 0.5 ? "critical" : "warning",
        };
      })
      .sort((a, b) => a.stock / (a.reorderLevel || 1) - b.stock / (b.reorderLevel || 1)),
    expiringSoon: nearExpiry
      .map((batch) => ({
        id: String(batch._id),
        batchNo: batch.batchNo,
        medicineName: batch.medicine?.name || "Unknown",
        expiryDate: batch.expiryDate,
        days: daysUntil(batch.expiryDate),
      }))
      .sort((a, b) => a.days - b.days),
    supplierCount: suppliers.length,
    generatedAt: now.toISOString(),
  };
}

export async function getAnalytics({ from, to } = {}) {
  const { from: start, to: end } = resolveDateRange({ from, to }, { defaultFromDays: 90 });
  const [sales, purchases, medicines, batches, suppliers] = await Promise.all([
    Sale.find({ date: { $gte: start, $lte: end }, status: "Completed" }).populate("medicine", "name category").lean(),
    Purchase.find({ date: { $gte: start, $lte: end } }).lean(),
    Medicine.find().lean(),
    Batch.find({ expiryDate: { $gte: startOfDayUtc() }, quantity: { $gt: 0 } }).populate("medicine", "name category").lean(),
    Supplier.find().lean(),
  ]);
  const salesByMonth = new Map();
  const purchaseByMonth = new Map();
  for (const sale of sales) {
    const key = monthKey(new Date(sale.date));
    salesByMonth.set(key, (salesByMonth.get(key) || 0) + Number(sale.total || 0));
  }
  for (const purchase of purchases) {
    const key = monthKey(new Date(purchase.date));
    purchaseByMonth.set(key, (purchaseByMonth.get(key) || 0) + Number(purchase.total || 0));
  }
  const trend = [...new Set([...salesByMonth.keys(), ...purchaseByMonth.keys()])]
    .sort()
    .map((key) => ({ month: monthLabel(key), sales: round2(salesByMonth.get(key) || 0), purchases: round2(purchaseByMonth.get(key) || 0) }));

  const revenue = sum(sales, "total");
  const cogs = sales.reduce((total, sale) => total + saleCogs(sale), 0);
  const grossProfit = round2(revenue - cogs);
  const grossMargin = revenue > 0 ? round2((grossProfit / revenue) * 100) : 0;

  // Current sellable inventory at cost.
  const inventoryValue = round2(batches.reduce((total, batch) => total + batch.quantity * batch.costPerUnit, 0));

  // Average inventory over the window, derived only from data actually stored:
  // opening stock = stock received in the window, and we cannot honestly
  // reconstruct a pre-window balance sheet, so the closing value is used for the
  // second term. This is labelled a Turnover Proxy everywhere it is displayed.
  const purchasedInRange = purchases.reduce((total, purchase) => total + Number(purchase.quantity || 0), 0);
  const openingUnits = purchasedInRange;
  const openingValue = purchases.reduce(
    (total, purchase) => total + Number(purchase.quantity || 0) * Number(purchase.unitCost || 0),
    0
  );
  const averageInventoryValue = (openingValue + inventoryValue) / 2;
  const turnoverProxy = averageInventoryValue > 0 ? round2(cogs / averageInventoryValue) : 0;

  const medicineMap = new Map(medicines.map((medicine) => [String(medicine._id), medicine]));
  const salesByMedicine = new Map();
  for (const sale of sales) {
    const id = String(sale.medicine?._id || sale.medicine);
    const current = salesByMedicine.get(id) || {
      name: sale.medicine?.name || medicineMap.get(id)?.name || "Unknown",
      value: 0,
      units: 0,
    };
    current.value += Number(sale.total || 0);
    current.units += Number(sale.quantity || 0);
    salesByMedicine.set(id, current);
  }
  const ranked = [...salesByMedicine.values()].map((row) => ({ ...row, value: round2(row.value) }));
  const topSelling = [...ranked].sort((a, b) => b.value - a.value).slice(0, 6);
  const slowMoving = [...ranked].sort((a, b) => a.value - b.value).slice(0, 5);
  const categoryMap = new Map();
  for (const batch of batches) {
    const categoryName = batch.medicine?.category || medicineMap.get(String(batch.medicine?._id || batch.medicine))?.category || "Other";
    categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + batch.quantity);
  }
  // Only a payment metric, because only payment data is stored.
  const supplierPerformance = suppliers.map((supplier) => {
    const related = purchases.filter((purchase) => String(purchase.supplier) === String(supplier._id));
    const settled = related.filter((purchase) => purchase.status === "Paid");
    return {
      name: supplier.name,
      status: supplier.status,
      purchaseOrders: related.length,
      totalPurchased: round2(related.reduce((total, purchase) => total + Number(purchase.total || 0), 0)),
      outstanding: round2(related.reduce((total, purchase) => total + Math.max(0, Number(purchase.total || 0) - Number(purchase.paidAmount || 0)), 0)),
      paymentCompliance: related.length ? Math.round((settled.length / related.length) * 100) : 0,
    };
  });
  const now = new Date();
  const riskBuckets = [
    { label: "0–7 days", test: (days) => days >= 0 && days <= 7, color: "#f87171" },
    { label: "8–30 days", test: (days) => days > 7 && days <= 30, color: "#fbbf24" },
    { label: "31–60 days", test: (days) => days > 30 && days <= 60, color: "#38bdf8" },
    { label: "60+ days", test: (days) => days > 60, color: "#34d399" },
  ];
  const expiryRisk = riskBuckets.map((bucket) => ({
    label: bucket.label,
    color: bucket.color,
    value: batches.filter((batch) => bucket.test(Math.round((startOfDayUtc(batch.expiryDate) - startOfDayUtc(now)) / 86400000))).length,
  }));
  const stock = new Map();
  for (const batch of batches) {
    const id = String(batch.medicine?._id || batch.medicine);
    stock.set(id, (stock.get(id) || 0) + batch.quantity);
  }
  const lowStock = medicines.filter((medicine) => (stock.get(String(medicine._id)) || 0) < medicine.reorderLevel);
  return {
    period: { from: start.toISOString(), to: end.toISOString() },
    summary: {
      revenue: round2(revenue),
      cogs: round2(cogs),
      grossProfit,
      grossMargin,
      inventoryValue,
      averageInventoryValue: round2(averageInventoryValue),
      openingUnits,
      // COGS / average inventory. This is a proxy because a true opening balance
      // for the window cannot be reconstructed from stored data.
      turnoverProxy,
      salesCount: sales.length,
      lowStock: lowStock.length,
    },
    trend,
    topSelling,
    slowMoving,
    category: [...categoryMap.entries()].map(([name, value]) => ({ name, value })),
    supplierPerformance,
    expiryRisk,
  };
}
