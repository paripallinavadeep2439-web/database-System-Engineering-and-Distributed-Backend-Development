import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import mongoose from "mongoose";

const port = Number(process.env.PORT || 5000);
let server;

async function start() {
  await connectDB();
  server = app.listen(port, () => {
    console.log(`PharmaStock API listening on port ${port}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
