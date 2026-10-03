import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ["low", "expiry", "expired", "system", "sale", "purchase"], index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    entityType: { type: String, trim: true, maxlength: 40 },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    // Alerts such as low stock or near-expiry are a shared operational feed, not a
    // private inbox, so a single boolean cannot mean "this user has seen it".
    // It means "this alert has been reviewed by a member of inventory staff", and
    // the reviewer is recorded so the claim is auditable.
    read: { type: Boolean, default: false, index: true },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    acknowledgedByEmail: { type: String, trim: true, maxlength: 160 },
    acknowledgedAt: { type: Date },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

export default mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
