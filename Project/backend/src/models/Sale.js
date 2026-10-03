import mongoose from "mongoose";
import { SALE_STATUSES } from "../constants.js";

const allocationSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },
    batchNo: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    saleNo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true, index: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true, index: true },
    allocations: { type: [allocationSchema], required: true },
    quantity: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "Quantity must be an integer" } },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    customer: { type: String, trim: true, maxlength: 160, default: "Walk-in" },
    date: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: SALE_STATUSES, default: "Completed" },
    refundedAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

saleSchema.index({ date: -1 });
saleSchema.index({ medicine: 1, date: -1 });

export default mongoose.models.Sale || mongoose.model("Sale", saleSchema);
