import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ROLE_VALUES, USER_STATUSES } from "../constants.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"] },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLE_VALUES, default: "Viewer", required: true },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    status: { type: String, enum: USER_STATUSES, default: "Active", required: true },
    joined: { type: Date, default: Date.now },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.index({ role: 1, status: 1 });
userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.models.User || mongoose.model("User", userSchema);
