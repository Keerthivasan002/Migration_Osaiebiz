import express from "express";
import fieldsRoutes from "./fieldsRoutes.js";
import uploadRoutes from "./uploadRoutes.js";
import migrateRoutes from "./migrateRoutes.js";
import conversationRoutes from "./conversationRoutes.js";
import srRoutes from "./srRoutes.js";

const router = express.Router();

router.use("/fields", fieldsRoutes);
router.use("/upload", uploadRoutes);
router.use("/migrate", migrateRoutes);
router.use("/conversation-migrate", conversationRoutes);
router.use("/sr-migrate", srRoutes);

export default router;
