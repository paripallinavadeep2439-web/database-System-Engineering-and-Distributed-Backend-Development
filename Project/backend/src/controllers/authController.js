import User from "../models/User.js";
import { signToken } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import { created, ok } from "../utils/http.js";
import { serializeUser } from "../utils/serializers.js";
import { optionalString, requiredString, validEmail } from "../utils/validation.js";

export async function login(req, res) {
  const email = validEmail(req.body.email, "email");
  const password = requiredString(req.body.password, "password", { min: 8, max: 200 });
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) throw unauthorized("Invalid email or password");
  if (user.status !== "Active") throw unauthorized("User account is inactive");
  user.lastLogin = new Date();
  await user.save();
  req.user = user;
  await recordAudit(req, { action: "LOGIN", entityType: "User", entityId: user._id });
  return ok(res, { token: signToken(user), user: serializeUser(user) });
}

export async function me(req, res) {
  return ok(res, serializeUser(req.user));
}

export async function updateProfile(req, res) {
  const updates = {};
  const name = optionalString(req.body.name, "name", { max: 120 });
  const phone = optionalString(req.body.phone, "phone", { max: 30 });
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (Object.keys(updates).length === 0) throw badRequest("No editable profile fields were supplied");
  // Role, status and email are deliberately not updatable here: privilege changes
  // go through the Admin user endpoint, which is audited as USER_UPDATE.
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  req.user = user;
  await recordAudit(req, { action: "PROFILE_UPDATE", entityType: "User", entityId: req.user._id, metadata: updates });
  return ok(res, serializeUser(req.user));
}

export async function changePassword(req, res) {
  const currentPassword = requiredString(req.body.currentPassword, "currentPassword", { min: 8, max: 200 });
  const newPassword = requiredString(req.body.newPassword, "newPassword", { min: 8, max: 200 });
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword))) throw badRequest("Current password is incorrect");
  user.password = newPassword;
  await user.save();
  await recordAudit(req, { action: "PASSWORD_CHANGE", entityType: "User", entityId: user._id });
  return ok(res, { changed: true });
}

export async function listUsers(req, res) {
  const users = await User.find().sort({ createdAt: -1 });
  return ok(res, users.map(serializeUser));
}

export async function createUser(req, res) {
  const payload = {
    name: requiredString(req.body.name, "name", { max: 120 }),
    email: validEmail(req.body.email, "email"),
    password: requiredString(req.body.password, "password", { min: 8, max: 200 }),
    role: req.body.role,
    phone: optionalString(req.body.phone, "phone", { max: 30 }) || "",
  };
  if (await User.exists({ email: payload.email })) throw badRequest("A user with that email already exists");
  const user = await User.create(payload);
  await recordAudit(req, { action: "USER_CREATE", entityType: "User", entityId: user._id, metadata: { email: user.email, role: user.role } });
  return created(res, serializeUser(user));
}

export async function updateUser(req, res) {
  const updates = {};
  for (const field of ["name", "phone", "role", "status"]) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (req.body.email !== undefined) updates.email = validEmail(req.body.email, "email");
  if (Object.keys(updates).length === 0) throw badRequest("No editable user fields were supplied");
  if (String(req.params.id) === String(req.user._id)) {
    // An admin who removes their own Admin role or deactivates their own account
    // locks everyone out of user administration, so it is refused explicitly.
    if (updates.status === "Inactive") throw badRequest("You cannot deactivate your own account");
    if (updates.role && updates.role !== req.user.role) throw badRequest("You cannot change your own role");
  }
  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!user) throw notFound("User not found");
  await recordAudit(req, { action: "USER_UPDATE", entityType: "User", entityId: user._id, metadata: updates });
  return ok(res, serializeUser(user));
}
