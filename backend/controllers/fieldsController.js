import axios from "axios";
import { getBaseHost } from "../utils/freshworksHost.js";

async function getTicketFields(req, res) {
  const { domain, apiKey, workspaceId, product } = req.body;

  if (!domain || !apiKey) {
    return res.status(400).json({
      error: "Domain and API Key are required to fetch fields.",
    });
  }

  const selectedProduct =
    product === "freshdesk" ? "freshdesk" : "freshservice";
  const baseHost = getBaseHost(domain, selectedProduct);

  const authHeader = `Basic ${Buffer.from(apiKey + ":X").toString("base64")}`;

  try {
    const path =
      selectedProduct === "freshdesk"
        ? "/api/v2/ticket_fields"
        : `/api/v2/ticket_form_fields${workspaceId ? `?workspace_id=${workspaceId}` : ""}`;
    const url = `https://${baseHost}${path}`;

    const response = await axios.get(url, {
      headers: { Authorization: authHeader },
    });

    const sourceFields =
      response.data.ticket_fields ||
      response.data.ticket_form_fields ||
      response.data.fields ||
      [];
    const fields = sourceFields.map((field) => ({
      id: field.name,
      label: field.label || field.name,
    }));

    res.json({ fields });
  } catch (error) {
    console.error(
      "Error fetching fields:",
      error.response?.data || error.message,
    );
    res.status(500).json({
      error:
        "Failed to fetch fields. Check domain/product, credentials, and workspace id.",
    });
  }
}

export { getTicketFields };
