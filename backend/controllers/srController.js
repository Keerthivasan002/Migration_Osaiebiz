import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import { sendEmailLogs } from "../services/emailService.js";
import { getTicketsApiUrl } from "../utils/freshworksHost.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function msBetweenRequests(limitPerMinute) {
  const n = parseInt(limitPerMinute, 10);
  const safe = Number.isFinite(n) && n > 0 ? n : 60;
  return Math.floor(60000 / safe);
}

async function runSrMigration(body) {
  const {
    fileData,
    mapping,
    domain,
    apiKey,
    limitPerMinute,
    notificationEmail,
    product,
  } = body;

  if (!Array.isArray(fileData)) return;

  const authHeader = `Basic ${Buffer.from(apiKey + ":X").toString("base64")}`;
  const msPerRequest = msBetweenRequests(limitPerMinute);
  const selectedProduct = product === "freshdesk" ? "freshdesk" : "freshservice";
  const ticketsUrl = getTicketsApiUrl(domain, selectedProduct);
  if (!ticketsUrl) {
    console.error("SR migration aborted: invalid domain.");
    return;
  }

  const successLogPath = path.join(__dirname, "..", "sr-success.log");
  const errorLogPath = path.join(__dirname, "..", "sr-error.log");
  fs.writeFileSync(successLogPath, "--- SR Success Log ---\\n");
  fs.writeFileSync(errorLogPath, "--- SR Error Log ---\\n");

  for (const [index, row] of fileData.entries()) {
    const payload = {};
    for (const [fileHeader, fsField] of Object.entries(mapping || {})) {
      if (fsField && row[fileHeader] !== undefined && row[fileHeader] !== "") {
        payload[fsField] = row[fileHeader];
      }
    }

    payload.type = "Service Request";

    if (payload.sr_number) {
      payload.custom_fields = {
        ...(payload.custom_fields || {}),
        sr_number: payload.sr_number,
      };
      delete payload.sr_number;
    }

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
        `Row ${index + 1}: SR created successfully [#${response.data.ticket.id}]\\n`,
      );
    } catch (error) {
      const errorMessage = error.response?.data?.description || error.message;
      fs.appendFileSync(errorLogPath, `Row ${index + 1}: Failed - ${errorMessage}\\n`);
    }

    await delay(msPerRequest);
  }

  try {
    await sendEmailLogs(notificationEmail, successLogPath, errorLogPath);
  } catch (emailErr) {
    console.error("Failed to send SR migration email:", emailErr.message);
  } finally {
    try {
      if (fs.existsSync(successLogPath)) fs.unlinkSync(successLogPath);
      if (fs.existsSync(errorLogPath)) fs.unlinkSync(errorLogPath);
    } catch (cleanupErr) {
      console.error("Failed to delete SR log files:", cleanupErr.message);
    }
  }
}

function startSrMigration(req, res) {
  const { fileData, domain, apiKey, mapping } = req.body;

  if (!Array.isArray(fileData)) {
    return res.status(400).json({ error: "fileData is required and must be an array." });
  }
  if (!domain || !apiKey) {
    return res.status(400).json({ error: "domain and apiKey are required." });
  }
  if (!mapping || typeof mapping !== "object") {
    return res.status(400).json({ error: "mapping is required for SR migration." });
  }

  res.json({ message: "Service request migration started.", status: "running" });

  runSrMigration(req.body).catch((err) => {
    console.error("SR migration failed:", err);
  });
}

export { startSrMigration };
