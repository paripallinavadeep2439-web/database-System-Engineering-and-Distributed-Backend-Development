import mongoose from "mongoose";
import { badRequest } from "./errors.js";

const isEmpty = (value) => value === undefined || value === null || value === "";

// Numbers arriving as JSON must be genuine numbers or numeric strings. Booleans,
// arrays, objects and nullish-but-present values are rejected instead of being
// silently coerced (Number(true) === 1 would otherwise be accepted).
function isNumericInput(value) {
  if (typeof value === "number") return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(trimmed);
}

export function requiredString(value, field, { min = 1, max = 500 } = {}) {
  if (isEmpty(value) || typeof value !== "string" || value.trim().length < min) {
    throw badRequest(`${field} is required`, { field });
  }
  if (value.trim().length > max) throw badRequest(`${field} is too long`, { field });
  return value.trim();
}

export function optionalString(value, field, { max = 500 } = {}) {
  if (isEmpty(value)) return undefined;
  if (typeof value !== "string") throw badRequest(`${field} must be a string`, { field });
  const result = value.trim();
  if (result.length > max) throw badRequest(`${field} is too long`, { field });
  return result;
}

export function validEmail(value, field = "email", { required = true } = {}) {
  if (isEmpty(value)) {
    if (required) throw badRequest(`${field} is required`, { field });
    return undefined;
  }
  if (typeof value !== "string" || !/^\S+@\S+\.\S+$/.test(value.trim())) {
    throw badRequest(`${field} must be a valid email`, { field });
  }
  return value.trim().toLowerCase();
}

export function numberValue(value, field, { min = -Infinity, max = Infinity, integer = false, required = true } = {}) {
  if (isEmpty(value)) {
    if (required) throw badRequest(`${field} is required`, { field });
    return undefined;
  }
  if (!isNumericInput(value)) throw badRequest(`${field} must be a number`, { field });
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) {
    throw badRequest(`${field} must be a valid number`, { field });
  }
  return result;
}

export function objectId(value, field, { required = true } = {}) {
  if (isEmpty(value)) {
    if (required) throw badRequest(`${field} is required`, { field });
    return undefined;
  }
  if (!mongoose.isValidObjectId(value)) throw badRequest(`${field} must be a valid id`, { field });
  return String(value);
}

export function enumValue(value, field, values, { required = true } = {}) {
  if (isEmpty(value)) {
    if (required) throw badRequest(`${field} is required`, { field });
    return undefined;
  }
  if (!values.includes(value)) throw badRequest(`${field} must be one of: ${values.join(", ")}`, { field });
  return value;
}

export function dateValue(value, field, { required = true } = {}) {
  if (isEmpty(value)) {
    if (required) throw badRequest(`${field} is required`, { field });
    return undefined;
  }
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw badRequest(`${field} must be a valid date`, { field });
  return result;
}

// Guards fields that must never be writable through a generic update endpoint.
// The message names the controlled workflow so the API contract is self-explanatory.
// Usage: `quantity: [rejectFields("Batch quantity cannot be edited directly...")]`
export function rejectFields(message, buildError = badRequest) {
  return function rejectProtectedFields(value, field) {
    if (value !== undefined) throw buildError(message, { field });
    return undefined;
  };
}

// Replaces the request body with exactly the fields declared in `schema`. The
// normalised values replace the raw input, so a rule that maps `"  12  "` to
// `12` is what downstream code receives. Nothing the client sent survives unless
// the route explicitly opted out via allowUnknownFields.
export function validateBody(schema, { allowUnknownFields = false } = {}) {
  return function validateRequestBody(req, res, next) {
    try {
      const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
      if (!allowUnknownFields) {
        const known = new Set(Object.keys(schema));
        const unknown = Object.keys(body).filter((key) => !known.has(key));
        if (unknown.length) {
          throw badRequest(`Unexpected field(s): ${unknown.sort().join(", ")}`, { fields: unknown.sort() });
        }
      }
      const result = {};
      for (const [field, rules] of Object.entries(schema)) {
        for (const rule of rules) result[field] = rule(body[field], field, body);
      }
      req.body = allowUnknownFields ? { ...body, ...result } : result;
      next();
    } catch (error) {
      next(error);
    }
  };
}
