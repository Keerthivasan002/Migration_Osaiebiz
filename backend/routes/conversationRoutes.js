import express from "express";
import { startConversationMigration } from "../controllers/conversationController.js";

const router = express.Router();

router.post("/", startConversationMigration);

export default router;
