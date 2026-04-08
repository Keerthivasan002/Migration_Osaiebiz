import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import MigrationLog from "../models/MigrationLog.js";
import { sendEmailLogs } from "../services/emailService.js";
import { getTicketsApiUrl } from "../utils/freshworksHost.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function msBetweenRequests(limitPerMinute) {
  const n = parseInt(limitPerMinute, 10);
  const safe = Number.isFinite(n) && n > 0 ? n : 60;
  return Math.floor(60000 / safe);
}

async function runMigration(body) {
  const {
    fileData,
    mapping,
    domain,
    apiKey,
    limitPerMinute,
    notificationEmail,
    filePath,
    fileName,
    product,
  } = body;

  if (!Array.isArray(fileData)) {
    console.error("Migration aborted: fileData must be an array.");
    return;
  }

  const msPerRequest = msBetweenRequests(limitPerMinute);
  const authHeader = `Basic ${Buffer.from(apiKey + ":X").toString("base64")}`;
  const selectedProduct = product === "freshdesk" ? "freshdesk" : "freshservice";
  const ticketsUrl = getTicketsApiUrl(domain, selectedProduct);
  if (!ticketsUrl) {
    console.error("Migration aborted: invalid domain.");
    return;
  }

  const successLogPath = path.join(__dirname, "..", "success.log");
  const errorLogPath = path.join(__dirname, "..", "error.log");
  fs.writeFileSync(successLogPath, "--- Success Log ---\n");
  fs.writeFileSync(errorLogPath, "--- Error Log ---\n");

  let fileBuffer = null;
  if (filePath && fs.existsSync(filePath)) {
    fileBuffer = fs.readFileSync(filePath);
  }

  const migrationDbRecord = new MigrationLog({
    domain,
    originalFileName: fileName,
    originalFileBuffer: fileBuffer,
    summary: {
      totalProcessed: fileData.length,
      successCount: 0,
      errorCount: 0,
    },
    records: [],
  });

  for (const [index, row] of fileData.entries()) {
    const payload = {};

    for (const [fileHeader, fsField] of Object.entries(mapping || {})) {
      if (fsField && row[fileHeader]) {
        payload[fsField] = row[fileHeader];
      }
    }

    const rowRecord = {
      rowNumber: index + 1,
      originalRowData: row,
      payloadSent: payload,
    };

    try {
      const response = await axios.post(
        ticketsUrl,
        payload,
        {
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
        },
      );

      fs.appendFileSync(
        successLogPath,
        `Row ${index + 1}: Ticket created successfully [#${response.data.ticket.id}]\n`,
      );
      rowRecord.status = "success";
      rowRecord.ticketId = response.data.ticket.id;
      migrationDbRecord.summary.successCount++;
    } catch (error) {
      const errorMessage = error.response?.data?.description || error.message;
      fs.appendFileSync(
        errorLogPath,
        `Row ${index + 1}: Failed - ${errorMessage}\n`,
      );
      rowRecord.status = "error";
      rowRecord.errorDetails = errorMessage;
      migrationDbRecord.summary.errorCount++;
    }

    migrationDbRecord.records.push(rowRecord);
    await delay(msPerRequest);
  }

  try {
    await migrationDbRecord.save();
    console.log("Migration saved to MongoDB successfully.");
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (dbError) {
    console.error("Failed to save to MongoDB:", dbError);
  }

  try {
    await sendEmailLogs(notificationEmail, successLogPath, errorLogPath);
  } catch (emailErr) {
    console.error("Failed to send migration email:", emailErr.message);
  } finally {
    try {
      if (fs.existsSync(successLogPath)) {
        fs.unlinkSync(successLogPath);
      }
      if (fs.existsSync(errorLogPath)) {
        fs.unlinkSync(errorLogPath);
      }
    } catch (cleanupErr) {
      console.error("Failed to delete log files:", cleanupErr.message);
    }
  }
}

function startMigration(req, res) {
  const { fileData, domain, apiKey } = req.body;

  if (!fileData || !Array.isArray(fileData)) {
    return res.status(400).json({
      error: "fileData is required and must be an array.",
    });
  }
  if (!domain || !apiKey) {
    return res.status(400).json({
      error: "domain and apiKey are required.",
    });
  }

  res.json({ message: "Migration started successfully.", status: "running" });

  runMigration(req.body).catch((err) => {
    console.error("Migration failed:", err);
  });
}

export { startMigration };
