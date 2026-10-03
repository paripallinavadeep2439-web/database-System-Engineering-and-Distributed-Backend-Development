import mongoose from "mongoose";

export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Create a .env file (see .env.example) with your MongoDB connection string."
    );
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("MongoDB connected successfully");
    return mongoose.connection;
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    throw err;
  }
}
