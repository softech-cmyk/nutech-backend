import express from "express";
import { protect, requireManager } from "../middleware/auth.js";
import {
  getPayrollSummary,
  paySalary,
  unpaySalary,
  payViaBankTransfer,
  payrollWebhook,
} from "../controllers/payrollController.js";

const router = express.Router();

router.get("/summary", protect, requireManager, getPayrollSummary);
router.post("/:userId/pay", protect, requireManager, paySalary);
router.delete("/:userId/pay", protect, requireManager, unpaySalary);
router.post("/:userId/payout", protect, requireManager, payViaBankTransfer);
router.post("/webhook", payrollWebhook); // called by RazorpayX directly — protected by signature check, not auth

export default router;
