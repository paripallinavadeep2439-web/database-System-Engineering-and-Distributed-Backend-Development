import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { ADMIN_ROLES, ROLE_VALUES, USER_STATUSES } from "../constants.js";
import { enumValue, optionalString, requiredString, validEmail, validateBody } from "../utils/validation.js";
import { createUser, listUsers, updateUser } from "../controllers/authController.js";

const router = Router();
router.use(authenticate, authorize(...ADMIN_ROLES));
const userRules = {
  name: [(value) => requiredString(value, "name", { max: 120 })],
  email: [(value) => validEmail(value, "email")],
  password: [(value) => requiredString(value, "password", { min: 8, max: 200 })],
  role: [(value) => enumValue(value, "role", ROLE_VALUES)],
  phone: [(value) => optionalString(value, "phone", { max: 30 }) || ""],
};
router.get("/users", asyncHandler(listUsers));
router.post("/users", validateBody(userRules), asyncHandler(createUser));
router.patch("/users/:id", validateBody({
  name: [(value) => optionalString(value, "name", { max: 120 })],
  email: [(value) => validEmail(value, "email", { required: false })],
  role: [(value) => enumValue(value, "role", ROLE_VALUES, { required: false })],
  status: [(value) => enumValue(value, "status", USER_STATUSES, { required: false })],
  phone: [(value) => optionalString(value, "phone", { max: 30 })],
}), asyncHandler(updateUser));

export default router;
