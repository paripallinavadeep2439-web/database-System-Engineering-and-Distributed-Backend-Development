import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, maxlength: 80, index: true },
    entityType: { type: String, required: true, trim: true, maxlength: 80, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    actorEmail: { type: String, trim: true, lowercase: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, trim: true, maxlength: 80 },
    userAgent: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export default mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
