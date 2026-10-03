import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";
import routes from "./routes/index.js";
import { AppError, notFound } from "./utils/errors.js";

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Express must only trust forwarding headers when the app really sits behind a
// proxy. Trusting them unconditionally lets any client spoof `X-Forwarded-For`
// and defeat the per-IP rate limiter, so it is opt-in and validated.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  if (trustProxy === "true") app.set("trust proxy", 1);
  else if (trustProxy !== "false") app.set("trust proxy", trustProxy.split(",").map((value) => value.trim()));
}

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new AppError("Origin is not allowed", { status: 403, code: "CORS_DENIED" }));
  },
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
}));
app.use(express.json({ limit: "1mb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX || 1000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please try again shortly." } },
}));

// Exposes whether the deployment can actually run stock transactions, so a
// verifier never has to infer replica-set support from the connection string.
app.get("/api/health", async (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const connected = mongoose.connection.readyState === 1;
  let replicaSet = null;
  let primary = null;
  if (connected) {
    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      replicaSet = hello.setName || null;
      primary = Boolean(hello.isWritablePrimary);
    } catch {
      replicaSet = null;
    }
  }
  return res.json({
    success: true,
    message: "PharmaStock API is running",
    database: states[mongoose.connection.readyState] || "unknown",
    transactions: {
      // MongoDB requires a replica set or a sharded cluster for multi-document
      // transactions. A standalone server cannot run purchase/sale/refund/adjust.
      required: true,
      supported: Boolean(replicaSet),
      replicaSet,
      writablePrimary: primary,
    },
    time: new Date().toISOString(),
  });
});

app.use("/api", routes);
app.use((req, res, next) => next(notFound("Route not found")));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  let normalized = error;
  if (error?.name === "ValidationError") {
    normalized = new AppError("Request validation failed", { status: 400, code: "VALIDATION_ERROR", details: Object.values(error.errors).map((item) => item.message) });
  } else if (error?.code === 11000) {
    normalized = new AppError("A record with that value already exists", { status: 409, code: "DUPLICATE_RECORD" });
  } else if (error?.name === "CastError") {
    normalized = new AppError("Invalid resource identifier", { status: 400, code: "INVALID_ID" });
  }
  const status = normalized.status || 500;
  const body = { success: false, error: { code: normalized.code || "INTERNAL_ERROR", message: status >= 500 && process.env.NODE_ENV === "production" ? "Internal server error" : normalized.message } };
  if (normalized.details) body.error.details = normalized.details;
  if (status >= 500) console.error(error);
  return res.status(status).json(body);
});

app.locals.notFound = notFound;
export default app;
