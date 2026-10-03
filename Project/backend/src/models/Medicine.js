import mongoose from "mongoose";
import { MEDICINE_CATEGORIES } from "../constants.js";

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160, index: true },
    generic: { type: String, required: true, trim: true, maxlength: 160, index: true },
    category: { type: String, required: true, enum: MEDICINE_CATEGORIES, index: true },
    manufacturer: { type: String, required: true, trim: true, maxlength: 160, index: true },
    dosage: { type: String, trim: true, maxlength: 80, default: "" },
    unitPrice: { type: Number, required: true, min: 0, default: 0 },
    reorderLevel: { type: Number, required: true, min: 0, default: 0, validate: { validator: Number.isInteger, message: "Reorder level must be an integer" } },
  },
  { timestamps: true }
);

medicineSchema.index({ name: "text", generic: "text", manufacturer: "text" });

export default mongoose.models.Medicine || mongoose.model("Medicine", medicineSchema);
