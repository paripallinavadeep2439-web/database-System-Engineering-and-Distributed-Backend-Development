import mongoose from "mongoose";
import { connectDB } from "../config/db.js";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

let failed = false;
try {
  await connectDB(uri);
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  console.log(`replica set name : ${hello.setName ?? "(none)"}`);
  console.log(`isWritablePrimary: ${hello.isWritablePrimary}`);
  console.log(`maxWireVersion   : ${hello.maxWireVersion}`);
  console.log(`database         : ${mongoose.connection.name}`);

  const topology = await mongoose.connection.db.admin().command({ replSetGetStatus: 1 });
  for (const member of topology.members) {
    console.log(`member           : ${member.name} state=${member.stateStr} health=${member.health}`);
  }
  if (!hello.setName) {
    console.error("FAIL: deployment is not a replica set; transactions are unavailable");
    failed = true;
  }

  const probe = mongoose.connection.db.collection("transaction_probe");
  const session = await mongoose.startSession();
  try {
    let inTransaction = false;
    await session.withTransaction(async () => {
      inTransaction = true;
      await probe.insertOne({ marker: "committed", at: new Date() }, { session });
    });
    if (!inTransaction) {
      console.error("FAIL: the transaction callback never executed");
      failed = true;
    }
    await probe.deleteMany({}, { session: undefined });
  } catch (error) {
    console.error(`FAIL: transaction probe failed: ${error.message}`);
    failed = true;
  } finally {
    await session.endSession();
    await probe.drop().catch(() => {});
  }

  console.log(failed ? "TRANSACTION PROBE: FAIL" : "TRANSACTION PROBE: PASS");
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  failed = true;
} finally {
  await mongoose.disconnect();
}
process.exit(failed ? 1 : 0);
