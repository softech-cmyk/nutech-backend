import express from "express";
import { protect, requireManager } from "../middleware/auth.js";
import {
  punchIn,
  punchOut,
  getTodayAttendance,
  getMyAttendance,
  getTeamAttendance,
  getAllAttendance,
  getSundayStatus,
  regularizeAttendance,
  markAttendance,
  clearTodayAttendance,
  clearAllAttendance,
  geocodeLocation,
  logLocationView,
  getLiveLocationsSnapshot,
} from "../controllers/attendanceController.js";

const router = express.Router();

router.post("/punch-in",         protect, punchIn);
router.post("/punch-out",        protect, punchOut);
router.get("/today",             protect, getTodayAttendance);
router.get("/my-records",        protect, getMyAttendance);
router.get("/team",              protect, getTeamAttendance);
router.get("/all",               protect, requireManager, getAllAttendance);
router.get("/sunday-status",     protect, requireManager, getSundayStatus);
router.post("/mark",             protect, requireManager, markAttendance);
router.patch("/:id/regularize",  protect, requireManager, regularizeAttendance);
router.post("/:id/view-location", protect, requireManager, logLocationView);
router.get("/geocode",           protect, geocodeLocation);
router.get("/live-locations",    protect, requireManager, getLiveLocationsSnapshot);
router.delete("/clear-today",    protect, clearTodayAttendance);
router.delete("/clear-all",      protect, clearAllAttendance);

export default router;
