import mongoose from "mongoose";
import { batchStatus } from "../utils/serializers.js";

const batchSchema = new mongoose.Schema(
  {
    batchNo: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 80 },
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    manufactureDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 0, default: 0, validate: { validator: Number.isInteger, message: "Quantity must be an integer" } },
    costPerUnit: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// The virtual delegates to the shared helper rather than re-deriving the rule,
// so a document rendered by Mongoose can never disagree with the status the API
// serializes for the same batch. Both truncate to a UTC day, which keeps the
// boundary on the same calendar day in any server timezone.
batchSchema.virtual("status").get(function getStatus() {
  return batchStatus({ quantity: this.quantity, expiryDate: this.expiryDate });
});

batchSchema.pre("validate", function validateDates(next) {
  if (this.expiryDate && this.manufactureDate && this.expiryDate <= this.manufactureDate) {
    next(new Error("Expiry date must be after the manufacture date"));
    return;
  }
  next();
});

batchSchema.index({ expiryDate: 1, quantity: 1 });
batchSchema.index({ medicine: 1, expiryDate: 1, quantity: 1 });

export default mongoose.models.Batch || mongoose.model("Batch", batchSchema);
