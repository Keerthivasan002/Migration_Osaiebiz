import express from "express";
import { startSrMigration } from "../controllers/srController.js";

const router = express.Router();

router.post("/", startSrMigration);

export default router;
