import fs from "node:fs";
import path from "node:path";
import csv from "csv-parser";
import xlsx from "xlsx";

const FRESHSERVICE_FIELDS = [
  { id: "subject", label: "Subject" },
  { id: "description", label: "Description" },
  { id: "email", label: "Requester Email" },
  { id: "status", label: "Status" },
  { id: "priority", label: "Priority" },
];

function parseCsvFile(filePath, originalName, res) {
  const results = [];
  const headers = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("headers", (headerList) => headers.push(...headerList))
    .on("data", (data) => results.push(data))
    .on("end", () => {
      res.json({
        filePath,
        fileName: originalName,
        fileData: results,
        fileHeaders: headers,
        freshserviceFields: FRESHSERVICE_FIELDS,
      });
    })
    .on("error", (err) => {
      console.error("CSV parse error:", err);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.status(500).send("Failed to parse CSV file.");
    });
}

function parseExcelFile(filePath, originalName, res) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const headerRow = xlsx.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
    const headers = headerRow.map(String);
    const results = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    res.json({
      filePath,
      fileName: originalName,
      fileData: results,
      fileHeaders: headers,
      freshserviceFields: FRESHSERVICE_FIELDS,
    });
  } catch (error) {
    console.error("Excel parse error:", error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).send("Failed to parse Excel file.");
  }
}

function uploadFile(req, res) {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const fileExt = path.extname(req.file.originalname).toLowerCase();
  const filePath = req.file.path;
  const originalName = req.file.originalname;

  if (fileExt === ".csv") {
    parseCsvFile(filePath, originalName, res);
  } else if (fileExt === ".xlsx" || fileExt === ".xls") {
    parseExcelFile(filePath, originalName, res);
  } else {
    fs.unlinkSync(filePath);
    return res
      .status(400)
      .send(
        "Unsupported file type. Please upload a .csv, .xls, or .xlsx file.",
      );
  }
}

export { uploadFile };
