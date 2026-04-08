import mongoose from "mongoose";

const MigrationLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  domain: String,
  originalFileName: String,
  originalFileBuffer: Buffer,
  summary: {
    totalProcessed: Number,
    successCount: Number,
    errorCount: Number,
  },
  records: [
    {
      rowNumber: Number,
      originalRowData: mongoose.Schema.Types.Mixed,
      payloadSent: mongoose.Schema.Types.Mixed,
      status: { type: String, enum: ["success", "error"] },
      ticketId: Number,
      errorDetails: String,
    },
  ],
});

export default mongoose.model("MigrationLog", MigrationLogSchema);
