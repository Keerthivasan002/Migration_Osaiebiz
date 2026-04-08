import mongoose from "mongoose";

const DEFAULT_URI =
  process.env.MONGODB_URI ||
  "mongodb://0.0.0.0:27017/freshservice_migration";

async function connectDB() {
  await mongoose.connect(DEFAULT_URI);
  console.log("Connected to MongoDB");
}

export { connectDB };
