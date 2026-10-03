import mongoose from "mongoose";

const inventoryAdjustmentSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true, index: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true, index: true },
    quantityDelta: { type: Number, required: true, validate: { validator: Number.isInteger, message: "Quantity adjustment must be an integer" } },
    quantityBefore: { type: Number, required: true, min: 0 },
    quantityAfter: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true, maxlength: 240 },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

inventoryAdjustmentSchema.index({ createdAt: -1 });

export default mongoose.models.InventoryAdjustment || mongoose.model("InventoryAdjustment", inventoryAdjustmentSchema);
