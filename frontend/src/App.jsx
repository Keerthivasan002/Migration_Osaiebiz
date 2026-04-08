import React, { useState } from "react";
import axios from "axios";
import "./App.css";

const CORE_FS_FIELDS = [
  { id: "subject", label: "Subject *" },
  { id: "description", label: "Description *" },
  { id: "email", label: "Requester Email *" },
  { id: "status", label: "Status *" },
  { id: "priority", label: "Priority *" },
];
const CONVERSATION_FIELDS = [
  { id: "ticket_id", label: "Ticket ID *" },
  { id: "conversation", label: "Conversation *" },
];
const SR_FIELDS = [
  ...CORE_FS_FIELDS,
  { id: "sr_number", label: "SR Number *" },
];

function mergeFields(core, dynamic) {
  const byId = new Map();
  for (const f of [...core, ...(dynamic || [])]) {
    if (f?.id) byId.set(f.id, f);
  }
  return Array.from(byId.values());
}

function ProductSelector({ product, setProduct }) {
  return (
    <div className="product-select-wrap">
      <label htmlFor="productSelect">Product</label>
      <select
        id="productSelect"
        value={product}
        onChange={(e) => setProduct(e.target.value)}
      >
        <option value="freshservice">Freshservice</option>
        <option value="freshdesk">Freshdesk</option>
      </select>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState("home");
  const [product, setProduct] = useState("freshservice");

  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    domain: "",
    apiKey: "",
    limitPerMinute: 30,
    email: "",
    workspaceId: "",
  });
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState([]);
  const [fileHeaders, setFileHeaders] = useState([]);
  const [fsFields, setFsFields] = useState([]);
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [mapping, setMapping] = useState({});
  const [conversationStep, setConversationStep] = useState(1);
  const [conversationFile, setConversationFile] = useState(null);
  const [conversationFileData, setConversationFileData] = useState([]);
  const [conversationFileHeaders, setConversationFileHeaders] = useState([]);
  const [conversationMapping, setConversationMapping] = useState({});

  const [srStep, setSrStep] = useState(1);
  const [srFile, setSrFile] = useState(null);
  const [srFileData, setSrFileData] = useState([]);
  const [srFileHeaders, setSrFileHeaders] = useState([]);
  const [srMapping, setSrMapping] = useState({});

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("http://localhost:5000/api/upload", formData);
      setFilePath(response.data.filePath);
      setFileName(file.name);
      setFileData(response.data.fileData);
      setFileHeaders(response.data.fileHeaders);
      setFsFields((prev) => (prev.length > 0 ? prev : mergeFields(CORE_FS_FIELDS, [])));
      setStep(2);
    } catch (error) {
      console.error("Upload failed", error);
    }
  };

  const fetchFields = async () => {
    if (!config.domain || !config.apiKey) {
      alert("Please enter Domain and API Key first.");
      return;
    }

    setIsLoadingFields(true);
    try {
      const response = await axios.post("http://localhost:5000/api/fields", {
        domain: config.domain,
        apiKey: config.apiKey,
        workspaceId: config.workspaceId,
        product,
      });
      setFsFields(mergeFields(CORE_FS_FIELDS, response.data.fields));
      alert("Fields fetched successfully!");
    } catch (error) {
      alert("Error fetching fields. Check console.");
    } finally {
      setIsLoadingFields(false);
    }
  };

  const handleMappingChange = (header, value) => {
    setMapping({ ...mapping, [header]: value });
  };
  const handleConversationMappingChange = (header, value) => {
    setConversationMapping({ ...conversationMapping, [header]: value });
  };
  const handleSrMappingChange = (header, value) => {
    setSrMapping({ ...srMapping, [header]: value });
  };

  const startMigration = async () => {
    const requiredFieldIds = ["subject", "description", "email", "priority", "status"];
    const mappedValues = new Set(Object.values(mapping || {}));
    const missing = requiredFieldIds.filter((id) => !mappedValues.has(id));

    if (missing.length > 0) {
      alert(
        "Please map all required fields before starting:\n" +
          "- Subject\n- Description\n- Requester Email\n- Priority\n- Status",
      );
      return;
    }

    try {
      await axios.post("http://localhost:5000/api/migrate", {
        fileData,
        mapping,
        domain: config.domain,
        apiKey: config.apiKey,
        limitPerMinute: config.limitPerMinute,
        notificationEmail: config.email,
        filePath,
        fileName,
        product,
      });
      setStep(3);
    } catch (error) {
      console.error("Migration failed", error);
    }
  };

  const uploadConversationFile = async () => {
    if (!conversationFile) return;
    const formData = new FormData();
    formData.append("file", conversationFile);
    try {
      const response = await axios.post("http://localhost:5000/api/upload", formData);
      setConversationFileData(response.data.fileData || []);
      setConversationFileHeaders(response.data.fileHeaders || []);
      setConversationStep(2);
    } catch (error) {
      console.error("Conversation upload failed", error);
    }
  };

  const startConversationMigration = async () => {
    const required = ["ticket_id", "conversation"];
    const mappedValues = new Set(Object.values(conversationMapping || {}));
    const missing = required.filter((id) => !mappedValues.has(id));
    if (missing.length > 0) {
      alert("Please map Ticket ID and Conversation before starting.");
      return;
    }
    try {
      await axios.post("http://localhost:5000/api/conversation-migrate", {
        fileData: conversationFileData,
        mapping: conversationMapping,
        domain: config.domain,
        apiKey: config.apiKey,
        limitPerMinute: config.limitPerMinute,
        notificationEmail: config.email,
        product,
      });
      setConversationStep(3);
    } catch (error) {
      console.error("Conversation migration failed", error);
    }
  };

  const uploadSrFile = async () => {
    if (!srFile) return;
    const formData = new FormData();
    formData.append("file", srFile);
    try {
      const response = await axios.post("http://localhost:5000/api/upload", formData);
      setSrFileData(response.data.fileData || []);
      setSrFileHeaders(response.data.fileHeaders || []);
      setSrStep(2);
    } catch (error) {
      console.error("SR upload failed", error);
    }
  };

  const startSrMigration = async () => {
    const required = ["subject", "description", "email", "priority", "status", "sr_number"];
    const mappedValues = new Set(Object.values(srMapping || {}));
    const missing = required.filter((id) => !mappedValues.has(id));
    if (missing.length > 0) {
      alert("Please map Subject, Description, Requester Email, Priority, Status and SR Number.");
      return;
    }
    try {
      await axios.post("http://localhost:5000/api/sr-migrate", {
        fileData: srFileData,
        mapping: srMapping,
        domain: config.domain,
        apiKey: config.apiKey,
        limitPerMinute: config.limitPerMinute,
        notificationEmail: config.email,
        product,
      });
      setSrStep(3);
    } catch (error) {
      console.error("SR migration failed", error);
    }
  };

  const renderIncidentPage = () => (
    <div>
      <div className="page-header">
        <h3>Incident Migration</h3>
        <ProductSelector product={product} setProduct={setProduct} />
      </div>
      <p className="muted-text">
        Incident migration is already configured. Upload your file, map required fields, and run the
        migration.
      </p>

      {step === 1 && (
        <div>
          <h3>Step 1: Configuration</h3>
          <div className="form-stack">
            <input
              type="text"
              placeholder="Freshservice/Freshdesk Domain"
              onChange={(e) => setConfig({ ...config, domain: e.target.value })}
            />
            <input
              type="password"
              placeholder="API Key"
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="Workspace ID (Optional)"
                style={{ marginBottom: 0 }}
                onChange={(e) => setConfig({ ...config, workspaceId: e.target.value })}
              />
              <button type="button" onClick={fetchFields} disabled={isLoadingFields}>
                {isLoadingFields ? "Loading..." : "Get Fields"}
              </button>
            </div>
            <input
              type="number"
              placeholder="API Limit Per Minute"
              onChange={(e) => setConfig({ ...config, limitPerMinute: e.target.value })}
            />
            <input
              type="email"
              placeholder="Notification Email"
              onChange={(e) => setConfig({ ...config, email: e.target.value })}
            />
            <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileChange} />
            <button onClick={handleUpload} disabled={!file || fsFields.length === 0}>
              {fsFields.length === 0 ? "Fetch Fields First" : "Upload & Map"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3>Step 2: Map Fields</h3>
          <p>Map your file headers to ticket fields.</p>
          <table>
            <thead>
              <tr>
                <th>Your File Header</th>
                <th>Ticket Field</th>
              </tr>
            </thead>
            <tbody>
              {fileHeaders.map((header) => (
                <tr key={header}>
                  <td>{header}</td>
                  <td>
                    <select onChange={(e) => handleMappingChange(header, e.target.value)}>
                      <option value="">-- Ignore --</option>
                      {fsFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="secondary-btn" onClick={() => setStep(1)}>
            Back
          </button>
          <button onClick={startMigration}>Start Migration</button>
        </div>
      )}

      {step === 3 && (
        <div className="success-message">
          <h3>Step 3: Migration Running</h3>
          <p>
            Processing in background with limit <strong>{config.limitPerMinute}</strong> calls/minute.
          </p>
          <p>
            Notification target: <strong>{config.email || "Not provided"}</strong>
          </p>
          <button onClick={() => window.location.reload()}>Start New Migration</button>
        </div>
      )}
    </div>
  );

  const renderHomePage = () => (
    <div>
      <div className="page-header">
        <h3>Home</h3>
        <ProductSelector product={product} setProduct={setProduct} />
      </div>
      <p className="muted-text">
        This migration tool helps move ticket data from spreadsheet files into <strong>{product}</strong> with mapping, rate-control, and audit logs.
      </p>
      <div className="feature-grid">
        <div className="feature-card">
          <h4>Incident Migration</h4>
          <p>Configured flow with upload, field mapping, and ticket creation.</p>
        </div>
        <div className="feature-card">
          <h4>Conversation Migration</h4>
          <p>
            Import file rows containing ticket id and conversation content, then append conversations
            to matching tickets.
          </p>
        </div>
        <div className="feature-card">
          <h4>Attachment Migration</h4>
          <p>In progress. Planned support for ticket-level attachment upload.</p>
        </div>
        <div className="feature-card">
          <h4>Service Request Migration</h4>
          <p>Supports file-based migration where SR number is available in the Excel content.</p>
        </div>
      </div>
    </div>
  );

  const renderConversationPage = () => (
    <div>
      <div className="page-header">
        <h3>Conversation Migration</h3>
        <ProductSelector product={product} setProduct={setProduct} />
      </div>
      <p className="muted-text">
        Use a file with ticket id (Freshservice or Freshdesk) and conversation content columns. The
        tool will map each row to the ticket and add the conversation.
      </p>
      {conversationStep === 1 && (
        <div className="form-stack">
          <input
            type="text"
            placeholder="Freshservice/Freshdesk Domain"
            onChange={(e) => setConfig({ ...config, domain: e.target.value })}
          />
          <input
            type="password"
            placeholder="API Key"
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          />
          <input
            type="number"
            placeholder="API Limit Per Minute"
            onChange={(e) => setConfig({ ...config, limitPerMinute: e.target.value })}
          />
          <input
            type="email"
            placeholder="Notification Email"
            onChange={(e) => setConfig({ ...config, email: e.target.value })}
          />
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={(e) => setConversationFile(e.target.files[0])}
          />
          <button onClick={uploadConversationFile} disabled={!conversationFile}>
            Upload & Map Conversation
          </button>
        </div>
      )}

      {conversationStep === 2 && (
        <div>
          <h4>Map Conversation Fields</h4>
          <table>
            <thead>
              <tr>
                <th>Your File Header</th>
                <th>Conversation Field</th>
              </tr>
            </thead>
            <tbody>
              {conversationFileHeaders.map((header) => (
                <tr key={header}>
                  <td>{header}</td>
                  <td>
                    <select
                      onChange={(e) => handleConversationMappingChange(header, e.target.value)}
                    >
                      <option value="">-- Ignore --</option>
                      {CONVERSATION_FIELDS.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="secondary-btn" onClick={() => setConversationStep(1)}>
            Back
          </button>
          <button onClick={startConversationMigration}>Start Conversation Migration</button>
        </div>
      )}

      {conversationStep === 3 && (
        <div className="success-message">
          <h4>Conversation Migration Running</h4>
          <p>Rows are being processed in background. You will receive email logs after completion.</p>
        </div>
      )}
    </div>
  );

  const renderAttachmentsPage = () => (
    <div>
      <div className="page-header">
        <h3>Attachment Migration</h3>
        <ProductSelector product={product} setProduct={setProduct} />
      </div>
      <div className="feature-card">
        <h4>Status: In Progress</h4>
        <p>
          Attachment migration is under implementation. UI and backend support for bulk file linking
          will be added next.
        </p>
      </div>
    </div>
  );

  const renderServiceRequestPage = () => (
    <div>
      <div className="page-header">
        <h3>Service Request Migration</h3>
        <ProductSelector product={product} setProduct={setProduct} />
      </div>
      {srStep === 1 && (
        <div className="form-stack">
          <input
            type="text"
            placeholder="Freshservice/Freshdesk Domain"
            onChange={(e) => setConfig({ ...config, domain: e.target.value })}
          />
          <input
            type="password"
            placeholder="API Key"
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          />
          <input
            type="number"
            placeholder="API Limit Per Minute"
            onChange={(e) => setConfig({ ...config, limitPerMinute: e.target.value })}
          />
          <input
            type="email"
            placeholder="Notification Email"
            onChange={(e) => setConfig({ ...config, email: e.target.value })}
          />
          <input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => setSrFile(e.target.files[0])} />
          <button onClick={uploadSrFile} disabled={!srFile}>
            Upload & Map SR
          </button>
        </div>
      )}

      {srStep === 2 && (
        <div>
          <h4>Map Service Request Fields</h4>
          <table>
            <thead>
              <tr>
                <th>Your File Header</th>
                <th>SR Field</th>
              </tr>
            </thead>
            <tbody>
              {srFileHeaders.map((header) => (
                <tr key={header}>
                  <td>{header}</td>
                  <td>
                    <select onChange={(e) => handleSrMappingChange(header, e.target.value)}>
                      <option value="">-- Ignore --</option>
                      {SR_FIELDS.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="secondary-btn" onClick={() => setSrStep(1)}>
            Back
          </button>
          <button onClick={startSrMigration}>Start SR Migration</button>
        </div>
      )}

      {srStep === 3 && (
        <div className="success-message">
          <h4>Service Request Migration Running</h4>
          <p>Rows are being processed in background. You will receive email logs after completion.</p>
        </div>
      )}
    </div>
  );

  const pageRenderer = {
    home: renderHomePage,
    incident: renderIncidentPage,
    conversation: renderConversationPage,
    attachments: renderAttachmentsPage,
    serviceRequest: renderServiceRequestPage,
  };

  return (
    <div className="container">
      <h2>Ticket Migration Hub</h2>
      <div className="navbar">
        <button
          className={activePage === "home" ? "nav-btn active" : "nav-btn"}
          onClick={() => setActivePage("home")}
        >
          Home
        </button>
        <button
          className={activePage === "incident" ? "nav-btn active" : "nav-btn"}
          onClick={() => setActivePage("incident")}
        >
          Incident
        </button>
        <button
          className={activePage === "conversation" ? "nav-btn active" : "nav-btn"}
          onClick={() => setActivePage("conversation")}
        >
          Conversation
        </button>
        <button
          className={activePage === "attachments" ? "nav-btn active" : "nav-btn"}
          onClick={() => setActivePage("attachments")}
        >
          Attachment
        </button>
        <button
          className={activePage === "serviceRequest" ? "nav-btn active" : "nav-btn"}
          onClick={() => setActivePage("serviceRequest")}
        >
          Service Request
        </button>
      </div>

      {pageRenderer[activePage]()}
    </div>
  );
}

export default App;
