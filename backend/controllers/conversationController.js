import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import { sendEmailLogs } from "../services/emailService.js";
import { getBaseHost } from "../utils/freshworksHost.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function msBetweenRequests(limitPerMinute) {
  const n = parseInt(limitPerMinute, 10);
  const safe = Number.isFinite(n) && n > 0 ? n : 60;
  return Math.floor(60000 / safe);
}

function getMappedValue(row, mapping, targetFieldIds) {
  for (const [fileHeader, mappedTo] of Object.entries(mapping || {})) {
    if (targetFieldIds.includes(mappedTo) && row[fileHeader] !== undefined && row[fileHeader] !== "") {
      return row[fileHeader];
    }
  }
  return "";
}

async function runConversationMigration(body) {
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
  const baseHost = getBaseHost(domain, selectedProduct);
  if (!baseHost) {
    console.error("Conversation migration aborted: invalid domain.");
    return;
  }

  const successLogPath = path.join(__dirname, "..", "conversation-success.log");
  const errorLogPath = path.join(__dirname, "..", "conversation-error.log");
  fs.writeFileSync(successLogPath, "--- Conversation Success Log ---\\n");
  fs.writeFileSync(errorLogPath, "--- Conversation Error Log ---\\n");

  for (const [index, row] of fileData.entries()) {
    const ticketId = getMappedValue(row, mapping, ["ticket_id", "ticketId", "id"]);
    const conversationBody = getMappedValue(row, mapping, ["conversation", "body", "note"]);

    if (!ticketId || !conversationBody) {
      fs.appendFileSync(
        errorLogPath,
        `Row ${index + 1}: Failed - Missing mapped ticket_id or conversation value\\n`,
      );
      await delay(msPerRequest);
      continue;
    }

    try {
      const noteUrl =
        selectedProduct === "freshdesk"
          ? `https://${baseHost}/api/v2/tickets/${ticketId}/reply`
          : `https://${baseHost}/api/v2/tickets/${ticketId}/notes`;
      const notePayload =
        selectedProduct === "freshdesk"
          ? { body: String(conversationBody), private: false }
          : { body: String(conversationBody), private: false };

      await axios.post(
        noteUrl,
        notePayload,
        {
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
        },
      );

      fs.appendFileSync(
        successLogPath,
        `Row ${index + 1}: Conversation added to ticket #${ticketId}\\n`,
      );
    } catch (error) {
      const errorMessage = error.response?.data?.description || error.message;
      fs.appendFileSync(
        errorLogPath,
        `Row ${index + 1}: Failed for ticket #${ticketId} - ${errorMessage}\\n`,
      );
    }

    await delay(msPerRequest);
  }

  try {
    await sendEmailLogs(notificationEmail, successLogPath, errorLogPath);
  } catch (emailErr) {
    console.error("Failed to send conversation migration email:", emailErr.message);
  } finally {
    try {
      if (fs.existsSync(successLogPath)) fs.unlinkSync(successLogPath);
      if (fs.existsSync(errorLogPath)) fs.unlinkSync(errorLogPath);
    } catch (cleanupErr) {
      console.error("Failed to delete conversation log files:", cleanupErr.message);
    }
  }
}

function startConversationMigration(req, res) {
  const { fileData, domain, apiKey, mapping } = req.body;

  if (!Array.isArray(fileData)) {
    return res.status(400).json({ error: "fileData is required and must be an array." });
  }
  if (!domain || !apiKey) {
    return res.status(400).json({ error: "domain and apiKey are required." });
  }
  if (!mapping || typeof mapping !== "object") {
    return res.status(400).json({ error: "mapping is required for conversation migration." });
  }

  res.json({ message: "Conversation migration started.", status: "running" });

  runConversationMigration(req.body).catch((err) => {
    console.error("Conversation migration failed:", err);
  });
}

export { startConversationMigration };
