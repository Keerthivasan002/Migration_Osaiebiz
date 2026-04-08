import express from "express";
import cors from "cors";
import { connectDB } from "./config/database.js";
import apiRoutes from "./routes/index.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

connectDB().catch((err) => console.error("MongoDB connection error:", err));

app.use("/api", apiRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
