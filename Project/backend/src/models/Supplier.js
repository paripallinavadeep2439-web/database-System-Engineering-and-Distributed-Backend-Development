import mongoose from "mongoose";
import { SUPPLIER_STATUSES } from "../constants.js";

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 160 },
    contact: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"] },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    status: { type: String, enum: SUPPLIER_STATUSES, default: "Active", required: true, index: true },
  },
  { timestamps: true }
);

supplierSchema.index({ name: "text", contact: "text" });

export default mongoose.models.Supplier || mongoose.model("Supplier", supplierSchema);
