import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../utils/asyncHandler.js";
import { optionalString, requiredString, validEmail, validateBody } from "../utils/validation.js";
import { authenticate } from "../middleware/auth.js";
import { changePassword, login, me, updateProfile } from "../controllers/authController.js";

const router = Router();
// Credential-shaped endpoints get a much tighter limit than the global limiter so
// password guessing against a known email address is not cheap.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: { code: "LOGIN_RATE_LIMITED", message: "Too many login attempts. Please try again in 15 minutes." } },
});

router.post("/login", authLimiter, validateBody({
  email: [(value) => validEmail(value, "email")],
  // Length is checked here but the value itself is never logged or echoed, so a
  // short password fails fast with a generic message.
  password: [(value) => requiredString(value, "password", { min: 8, max: 128 })],
}), asyncHandler(login));
router.get("/me", authenticate, asyncHandler(me));
// Profile is a partial update: a caller changing only their phone number must
// not be forced to resend their name.
router.patch("/me", authenticate, validateBody({
  name: [(value) => optionalString(value, "name", { max: 120 })],
  phone: [(value) => optionalString(value, "phone", { max: 30 })],
}), asyncHandler(updateProfile));
router.post("/change-password", authenticate, validateBody({
  currentPassword: [(value) => requiredString(value, "currentPassword", { min: 8, max: 128 })],
  newPassword: [(value) => requiredString(value, "newPassword", { min: 8, max: 128 })],
}), asyncHandler(changePassword));

export default router;
