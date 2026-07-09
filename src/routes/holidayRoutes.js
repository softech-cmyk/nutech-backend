import express from "express";
import { protect, requireManager } from "../middleware/auth.js";
import {
  getHolidays,
  getTodayHoliday,
  createHoliday,
  deleteHoliday,
} from "../controllers/holidayController.js";

const router = express.Router();

router.get("/",       protect, getHolidays);
router.get("/today",  protect, getTodayHoliday);
router.post("/",      protect, requireManager, createHoliday);
router.delete("/:id", protect, requireManager, deleteHoliday);

export default router;
