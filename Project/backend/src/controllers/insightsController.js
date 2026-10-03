import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import Notification from "../models/Notification.js";
import { getAnalytics, getDashboardData } from "../services/dashboardService.js";
import { dateRangeFilter } from "../utils/dates.js";
import { recordAudit } from "../middleware/audit.js";
import { serializeAudit, serializeNotification } from "../utils/serializers.js";
import { notFound } from "../utils/errors.js";
import { ok, pageMeta, parsePaging } from "../utils/http.js";

export async function dashboard(req, res) {
  return ok(res, await getDashboardData());
}

export async function analytics(req, res) {
  return ok(res, await getAnalytics({ from: req.query.from, to: req.query.to }));
}

export async function listNotifications(req, res) {
  const { page, limit, skip } = parsePaging(req.query, 30, 100);
  const filter = {};
  if (req.query.unread === "true") filter.read = false;
  if (req.query.type && req.query.type !== "All") filter.type = req.query.type;
  Object.assign(filter, dateRangeFilter(req.query, { field: "createdAt" }));
  if (req.query.search) {
    const expression = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: expression }, { message: expression }];
  }
  const [total, unread, rows] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ read: false }),
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
  ]);
  return ok(res, rows.map(serializeNotification), { ...pageMeta(total, page, limit), unread });
}

export async function markNotificationRead(req, res) {
  // The alert feed is shared, so acknowledgement records WHO reviewed the alert
  // instead of flipping an anonymous flag that no one can be shown to own.
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { read: true, acknowledgedBy: req.user.id, acknowledgedByEmail: req.user.email, acknowledgedAt: new Date() },
    { new: true },
  );
  if (!notification) throw notFound("Notification not found");
  await recordAudit(req, {
    action: "NOTIFICATION_ACKNOWLEDGE",
    entityType: "Notification",
    entityId: notification._id,
    metadata: { type: notification.type, title: notification.title },
  });
  return ok(res, serializeNotification(notification));
}

export async function listAudits(req, res) {
  const { page, limit, skip } = parsePaging(req.query, 50, 200);
  const filter = {};
  if (req.query.action) filter.action = new RegExp(`^${String(req.query.action).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.entityId && mongoose.isValidObjectId(req.query.entityId)) filter.entityId = req.query.entityId;
  if (req.query.actorId && mongoose.isValidObjectId(req.query.actorId)) filter.actor = req.query.actorId;
  const dateFilter = dateRangeFilter(req.query, { field: "createdAt" });
  Object.assign(filter, dateFilter);
  if (req.query.search) {
    const expression = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ actorEmail: expression }, { action: expression }, { entityType: expression }];
  }
  const [total, rows] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .populate("actor", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);
  return ok(res, rows.map(serializeAudit), pageMeta(total, page, limit));
}

export async function listAuditActions(req, res) {
  return ok(res, await AuditLog.distinct("action"));
}
