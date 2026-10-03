import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { forbidden, unauthorized } from "../utils/errors.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value === "change_me_to_a_long_random_string" || value.length < 32) {
    throw new Error("JWT_SECRET must be a strong application-specific value");
  }
  return value;
}

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, email: user.email }, secret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    issuer: "pharmastock-api",
    audience: "pharmastock-web",
  });
}

export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) throw unauthorized();
  const token = header.slice(7).trim();
  let payload;
  try {
    payload = jwt.verify(token, secret(), { issuer: "pharmastock-api", audience: "pharmastock-web" });
  } catch {
    throw unauthorized("Invalid or expired access token");
  }
  const user = await User.findById(payload.sub);
  if (!user || user.status !== "Active") throw unauthorized("User account is inactive or unavailable");
  req.user = user;
  req.auth = payload;
  next();
});

export function authorize(...roles) {
  return function authorization(req, res, next) {
    if (!req.user) return next(unauthorized());
    if (roles.length && !roles.includes(req.user.role)) return next(forbidden());
    return next();
  };
}
