import express from "express";
import { protect } from "../middleware/auth.js";
import { applyLeave, getAllLeaves, getMyLeaves, approveLeave, rejectLeave, clearAllLeaves } from "../controllers/leaveController.js";

const router = express.Router();

router.post("/apply",         protect, applyLeave);
router.get("/all",            protect, getAllLeaves);
router.get("/my",             protect, getMyLeaves);
router.patch("/:id/approve",  protect, approveLeave);
router.patch("/:id/reject",   protect, rejectLeave);
router.delete("/clear-all",   protect, clearAllLeaves);

export default router;
