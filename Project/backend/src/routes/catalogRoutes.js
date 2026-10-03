import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { immutableField } from "../utils/errors.js";
import { authorize, authenticate } from "../middleware/auth.js";
import { INVENTORY_ROLES, MEDICINE_CATEGORIES, READ_ROLES, SUPPLIER_STATUSES } from "../constants.js";
import { dateValue, enumValue, numberValue, objectId, optionalString, rejectFields, requiredString, validEmail, validateBody } from "../utils/validation.js";
import { createBatch, createMedicine, createSupplier, deleteBatch, deleteMedicine, deleteSupplier, getBatch, getMedicine, getSupplier, listBatches, listMedicines, listSuppliers, search, updateBatch, updateMedicine, updateSupplier } from "../controllers/catalogController.js";

const router = Router();
router.use(authenticate);

const medicineRules = {
  name: [(value) => requiredString(value, "name", { max: 160 })],
  generic: [(value) => requiredString(value, "generic", { max: 160 })],
  category: [(value) => enumValue(value, "category", MEDICINE_CATEGORIES)],
  manufacturer: [(value) => requiredString(value, "manufacturer", { max: 160 })],
  dosage: [(value) => optionalString(value, "dosage", { max: 80 }) || ""],
  unitPrice: [(value) => numberValue(value, "unitPrice", { min: 0 })],
  reorderLevel: [(value) => numberValue(value, "reorderLevel", { min: 0, integer: true })],
};

// A batch is created empty. Stock and cost are introduced only by a purchase so
// that Batch.quantity, the Purchase ledger and the audit log cannot disagree.
const batchRules = {
  batchNo: [(value) => requiredString(value, "batchNo", { min: 2, max: 80 })],
  medicineId: [(value) => objectId(value, "medicineId")],
  supplierId: [(value) => objectId(value, "supplierId")],
  manufactureDate: [(value) => dateValue(value, "manufactureDate")],
  expiryDate: [(value) => dateValue(value, "expiryDate")],
  quantity: [rejectFields("A new batch cannot be given stock directly. Create it empty, then record a purchase to add quantity and cost.", immutableField)],
  costPerUnit: [rejectFields("A new batch cannot be given a cost directly. Record a purchase, which sets the weighted-average unit cost.", immutableField)],
};

const updateMedicineRules = {
  name: [(value) => optionalString(value, "name", { max: 160 })],
  generic: [(value) => optionalString(value, "generic", { max: 160 })],
  category: [(value) => enumValue(value, "category", MEDICINE_CATEGORIES, { required: false })],
  manufacturer: [(value) => optionalString(value, "manufacturer", { max: 160 })],
  dosage: [(value) => optionalString(value, "dosage", { max: 80 }) || ""],
  unitPrice: [(value) => numberValue(value, "unitPrice", { min: 0, required: false })],
  reorderLevel: [(value) => numberValue(value, "reorderLevel", { min: 0, integer: true, required: false })],
};

const updateBatchRules = {
  batchNo: [(value) => optionalString(value, "batchNo", { max: 80 })],
  medicineId: [(value) => objectId(value, "medicineId", { required: false })],
  supplierId: [(value) => objectId(value, "supplierId", { required: false })],
  manufactureDate: [(value) => dateValue(value, "manufactureDate", { required: false })],
  expiryDate: [(value) => dateValue(value, "expiryDate", { required: false })],
  // `Batch.quantity` is the single source of truth for stock and `costPerUnit`
  // feeds inventory value and cost of goods sold. Neither may be edited through a
  // generic update, otherwise the inventory ledger can be bypassed without an
  // audit entry or a transaction. Both are writable only through the controlled
  // workflows: POST /purchases, POST /sales, POST /sales/:id/refund and
  // POST /adjustments.
  quantity: [rejectFields("Batch quantity cannot be edited directly. Use a purchase, sale, refund or inventory adjustment to change stock.", immutableField)],
  costPerUnit: [rejectFields("Batch cost cannot be edited directly. Record a purchase to change a batch's weighted-average cost.", immutableField)],
};

const supplierRules = {
  name: [(value) => requiredString(value, "name", { max: 160 })],
  contact: [(value) => requiredString(value, "contact", { max: 120 })],
  email: [(value) => validEmail(value, "email", { required: false }) || ""],
  phone: [(value) => optionalString(value, "phone", { max: 30 }) || ""],
  status: [(value) => enumValue(value, "status", SUPPLIER_STATUSES)],
};

const updateSupplierRules = {
  name: [(value) => optionalString(value, "name", { max: 160 })],
  contact: [(value) => optionalString(value, "contact", { max: 120 })],
  email: [(value) => validEmail(value, "email", { required: false }) || ""],
  phone: [(value) => optionalString(value, "phone", { max: 30 }) || ""],
  status: [(value) => enumValue(value, "status", SUPPLIER_STATUSES, { required: false })],
};

router.get("/search", authorize(...READ_ROLES), asyncHandler(search));
router.get("/medicines", authorize(...READ_ROLES), asyncHandler(listMedicines));
router.post("/medicines", authorize(...INVENTORY_ROLES), validateBody(medicineRules), asyncHandler(createMedicine));
router.get("/medicines/:id", authorize(...READ_ROLES), asyncHandler(getMedicine));
router.patch("/medicines/:id", authorize(...INVENTORY_ROLES), validateBody(updateMedicineRules), asyncHandler(updateMedicine));
router.delete("/medicines/:id", authorize(...INVENTORY_ROLES), asyncHandler(deleteMedicine));

router.get("/batches", authorize(...READ_ROLES), asyncHandler(listBatches));
router.post("/batches", authorize(...INVENTORY_ROLES), validateBody(batchRules), asyncHandler(createBatch));
router.get("/batches/:id", authorize(...READ_ROLES), asyncHandler(getBatch));
router.patch("/batches/:id", authorize(...INVENTORY_ROLES), validateBody(updateBatchRules), asyncHandler(updateBatch));
router.delete("/batches/:id", authorize(...INVENTORY_ROLES), asyncHandler(deleteBatch));

router.get("/suppliers", authorize(...READ_ROLES), asyncHandler(listSuppliers));
router.post("/suppliers", authorize(...INVENTORY_ROLES), validateBody(supplierRules), asyncHandler(createSupplier));
router.get("/suppliers/:id", authorize(...READ_ROLES), asyncHandler(getSupplier));
router.patch("/suppliers/:id", authorize(...INVENTORY_ROLES), validateBody(updateSupplierRules), asyncHandler(updateSupplier));
router.delete("/suppliers/:id", authorize(...INVENTORY_ROLES), asyncHandler(deleteSupplier));

export default router;
