import AuditLog from "../models/AuditLog.js";

// Single definition of the fields an audit row stores, so the standalone writer
// and the builder handed to a transaction can never drift apart, and so no caller
// can accidentally omit the actor.
function auditEntry(req, { action, entityType, entityId, metadata = {} }) {
  return {
    action,
    entityType,
    entityId,
    actor: req.user._id,
    actorEmail: req.user.email,
    metadata,
    ipAddress: req.ip,
    userAgent: req.get?.("user-agent") || "",
  };
}

/**
 * Builds the audit document for a request without writing it. Callers that must
 * commit the audit row inside their own transaction hand the result to the
 * service, which inserts it on the same session, so an audit entry can never be
 * missing after a committed stock movement. Plain non-stock writes use
 * `recordAudit` directly.
 */
export function auditDocument(req, descriptor) {
  return auditEntry(req, descriptor);
}

export async function recordAudit(req, descriptor = {}) {
  if (!req?.user || !descriptor.action) return null;
  return AuditLog.create(auditEntry(req, descriptor));
}
