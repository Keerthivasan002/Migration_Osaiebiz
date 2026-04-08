import express from "express";
import { startMigration } from "../controllers/migrateController.js";

const router = express.Router();

router.post("/", startMigration);

export default router;
