export class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL_ERROR", details } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message = "Resource not found") {
  return new AppError(message, { status: 404, code: "NOT_FOUND" });
}

export function badRequest(message, details) {
  return new AppError(message, { status: 400, code: "VALIDATION_ERROR", details });
}

// A rejected attempt to change protected state. This is kept distinct from a
// generic validation failure so a client can tell "your field is malformed" from
// "quantity is not editable here", which needs a different message and flow.
export function immutableField(message, details) {
  return new AppError(message, { status: 400, code: "BATCH_STOCK_IMMUTABLE", details });
}

export function unauthorized(message = "Authentication required") {
  return new AppError(message, { status: 401, code: "UNAUTHENTICATED" });
}

export function forbidden(message = "You do not have permission to perform this action") {
  return new AppError(message, { status: 403, code: "FORBIDDEN" });
}

export function conflict(message, details) {
  return new AppError(message, { status: 409, code: "CONFLICT", details });
}
