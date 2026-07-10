import express from "express";
import { protect } from "../middleware/auth.js";
import { getVapidPublicKey, subscribe } from "../controllers/notificationController.js";

const router = express.Router();

router.get("/vapid-public-key", getVapidPublicKey);
router.post("/subscribe",       protect, subscribe);

export default router;
