import express from "express";
import { getTicketFields } from "../controllers/fieldsController.js";

const router = express.Router();

router.post("/", getTicketFields);

export default router;
