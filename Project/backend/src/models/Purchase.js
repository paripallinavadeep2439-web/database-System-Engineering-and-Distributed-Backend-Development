import mongoose from "mongoose";
import { PURCHASE_STATUSES } from "../constants.js";

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true, index: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true, index: true },
    quantity: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "Quantity must be an integer" } },
    unitCost: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, min: 0, default: 0 },
    date: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: PURCHASE_STATUSES, default: "Pending" },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

purchaseSchema.index({ date: -1 });
purchaseSchema.index({ supplier: 1, date: -1 });

export default mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);
