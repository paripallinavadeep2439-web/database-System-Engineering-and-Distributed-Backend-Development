import { Router } from "express";
import authRoutes from "./authRoutes.js";
import catalogRoutes from "./catalogRoutes.js";
import transactionRoutes from "./transactionRoutes.js";
import insightRoutes from "./insightRoutes.js";
import adminRoutes from "./adminRoutes.js";

const router = Router();
router.use("/auth", authRoutes);
router.use(catalogRoutes);
router.use(transactionRoutes);
router.use(insightRoutes);
router.use(adminRoutes);

export default router;
