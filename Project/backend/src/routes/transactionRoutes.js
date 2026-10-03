import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authorize, authenticate } from "../middleware/auth.js";
import { INVENTORY_ROLES, PURCHASE_STATUSES, READ_ROLES, TRANSACTION_ROLES } from "../constants.js";
import { dateValue, enumValue, numberValue, objectId, optionalString, requiredString, validateBody } from "../utils/validation.js";
import { adjustInventoryController, createPurchase, createSale, getPurchase, getSale, listAdjustments, listPurchases, listSales, refundSaleController } from "../controllers/transactionController.js";

const router = Router();
router.use(authenticate);

const purchaseRules = {
  medicineId: [(value) => objectId(value, "medicineId")],
  supplierId: [(value) => objectId(value, "supplierId")],
  batchId: [(value) => objectId(value, "batchId")],
  quantity: [(value) => numberValue(value, "quantity", { min: 1, integer: true })],
  unitCost: [(value) => numberValue(value, "unitCost", { min: 0, required: false })],
  date: [(value) => dateValue(value, "date", { required: false })],
  status: [(value) => enumValue(value, "status", PURCHASE_STATUSES, { required: false })],
  paidAmount: [(value) => numberValue(value, "paidAmount", { min: 0, required: false })],
  notes: [(value) => optionalString(value, "notes", { max: 500 }) || ""],
};

const saleRules = {
  medicineId: [(value) => objectId(value, "medicineId")],
  quantity: [(value) => numberValue(value, "quantity", { min: 1, integer: true })],
  unitPrice: [(value) => numberValue(value, "unitPrice", { min: 0, required: false })],
  date: [(value) => dateValue(value, "date", { required: false })],
  customer: [(value) => optionalString(value, "customer", { max: 160 }) || "Walk-in"],
  notes: [(value) => optionalString(value, "notes", { max: 500 }) || ""],
};

const adjustmentRules = {
  medicineId: [(value) => objectId(value, "medicineId")],
  batchId: [(value) => objectId(value, "batchId")],
  quantityDelta: [(value) => numberValue(value, "quantityDelta", { integer: true })],
  reason: [(value) => requiredString(value, "reason", { max: 240 })],
  note: [(value) => optionalString(value, "note", { max: 500 }) || ""],
};

router.get("/purchases", authorize(...READ_ROLES), asyncHandler(listPurchases));
router.post("/purchases", authorize(...INVENTORY_ROLES), validateBody(purchaseRules), asyncHandler(createPurchase));
router.get("/purchases/:id", authorize(...READ_ROLES), asyncHandler(getPurchase));
router.get("/sales", authorize(...READ_ROLES), asyncHandler(listSales));
router.post("/sales", authorize(...TRANSACTION_ROLES), validateBody(saleRules), asyncHandler(createSale));
router.get("/sales/:id", authorize(...READ_ROLES), asyncHandler(getSale));
// The reason is optional but recorded in the audit entry, because a refund with
// no stated cause is the hardest kind of stock change to defend after the fact.
router.post("/sales/:id/refund", authorize(...INVENTORY_ROLES), validateBody({
  reason: [(value) => optionalString(value, "reason", { max: 240 })],
}), asyncHandler(refundSaleController));
router.get("/adjustments", authorize(...INVENTORY_ROLES), asyncHandler(listAdjustments));
router.post("/adjustments", authorize(...INVENTORY_ROLES), validateBody(adjustmentRules), asyncHandler(adjustInventoryController));

export default router;
