import Supplier from "../models/Supplier.js";
import Purchase from "../models/Purchase.js";
import { round2, serializeSupplier } from "../utils/serializers.js";

export async function getSupplierMetrics() {
  const [suppliers, purchases] = await Promise.all([
    Supplier.find().lean(),
    Purchase.find().lean(),
  ]);
  const metrics = new Map();
  for (const supplier of suppliers) {
    const related = purchases.filter((purchase) => String(purchase.supplier) === String(supplier._id));
    const settled = related.filter((purchase) => purchase.status === "Paid");
    metrics.set(String(supplier._id), {
      medicinesSupplied: new Set(related.map((purchase) => String(purchase.medicine))).size,
      purchaseOrders: related.length,
      totalPurchased: related.reduce((total, purchase) => total + Number(purchase.total || 0), 0),
      outstanding: related.reduce((total, purchase) => total + Math.max(0, Number(purchase.total || 0) - Number(purchase.paidAmount || 0)), 0),
      // Only stored purchase data is used. A supplier with no purchase history
      // has no measurable payment record, so it reports 0 rather than a
      // flattering 100.
      paymentCompliance: related.length ? Math.round((settled.length / related.length) * 100) : 0,
    });
  }
  return suppliers.map((supplier) => serializeSupplier(supplier, {
    ...metrics.get(String(supplier._id)),
    totalPurchased: round2(metrics.get(String(supplier._id))?.totalPurchased || 0),
  }));
}
