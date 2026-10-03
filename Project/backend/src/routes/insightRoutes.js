import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authorize, authenticate } from "../middleware/auth.js";
import { ADMIN_ROLES, INVENTORY_ROLES } from "../constants.js";
import { analytics, dashboard, listAuditActions, listAudits, listNotifications, markNotificationRead } from "../controllers/insightsController.js";
import { report } from "../controllers/reportController.js";

const router = Router();
router.use(authenticate);
router.get("/dashboard", asyncHandler(dashboard));
router.get("/analytics", asyncHandler(analytics));
router.get("/reports", asyncHandler(report));
router.get("/notifications", asyncHandler(listNotifications));
// Viewing the shared alert feed is open to any authenticated user, but clearing
// an alert is a state change, so it is restricted to inventory staff.
router.patch("/notifications/:id/read", authorize(...INVENTORY_ROLES), asyncHandler(markNotificationRead));
// Admin only. Declared before `/audit-logs` so the literal path is not captured
// by a parameterised sibling.
router.get("/audit-logs/actions", authorize(...ADMIN_ROLES), asyncHandler(listAuditActions));
router.get("/audit-logs", authorize(...ADMIN_ROLES), asyncHandler(listAudits));

export default router;
