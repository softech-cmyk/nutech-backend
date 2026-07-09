import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import axios from "axios";

// Today's date as "YYYY-MM-DD"
const todayStr = () => new Date().toISOString().slice(0, 10);

// Punch-ins more than this many minutes after an employee's own shift start are late.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const LATE_GRACE_MINUTES = 15;
const MONTHLY_LATE_REBATES = 3;

// Sunday is only a paid holiday if the employee worked at least 4.5 of their
// own standard shift-days (Mon–Sat) that week.
const SUNDAY_HOLIDAY_DAYS = 4.5;

const fmtDate = (d) => d.toISOString().slice(0, 10); // d must already be a UTC-midnight Date

// "HH:mm" -> minutes since midnight. Falls back to the default 10:00 shift start
// if the value is missing/malformed (e.g. records created before shifts existed).
const parseTimeToMinutes = (hhmm, fallback = "10:00") => {
  const [h, m] = (/^\d{2}:\d{2}$/.test(hhmm || "") ? hhmm : fallback).split(":").map(Number);
  return h * 60 + m;
};

const shiftDurationMinutes = (shiftStart, shiftEnd) =>
  parseTimeToMinutes(shiftEnd, "18:30") - parseTimeToMinutes(shiftStart, "10:00");

// Computed off the UTC instant + a fixed IST offset, so this is correct
// regardless of the server's own local timezone.
export const isLateArrival = (punchInTime, shiftStart = "10:00") => {
  const ist = new Date(punchInTime.getTime() + IST_OFFSET_MS);
  const minutesOfDay = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return minutesOfDay > parseTimeToMinutes(shiftStart) + LATE_GRACE_MINUTES;
};

// POST /api/attendance/punch-in
export const punchIn = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const date = todayStr();
    const existing = await Attendance.findOne({ userId: user._id, date });

    const lastSession = existing?.sessions?.[existing.sessions.length - 1];
    if (lastSession && !lastSession.punchOut) {
      return res.status(409).json({ message: "Already punched in. Punch out first." });
    }

    const { lat, lng, address } = req.body;
    const punchInTime = new Date();
    const shiftStart = user.shiftStart || "10:00";
    const shiftEnd   = user.shiftEnd   || "18:30";

    // Late-arrival / rebate status is decided once, off the day's very first
    // punch-in — stepping out and back later doesn't re-trigger it.
    const isFirstPunch = !existing || !existing.sessions?.length;
    let late = existing?.lateArrival || false;
    let rebateApplied = existing?.lateRebateApplied || false;
    let lateRebatesUsed = 0;

    if (isFirstPunch) {
      late = isLateArrival(punchInTime, shiftStart);
      if (late) {
        const firstOfMonth = `${date.slice(0, 7)}-01`;
        const priorLateCount = await Attendance.countDocuments({
          userId: user._id,
          lateArrival: true,
          date: { $gte: firstOfMonth, $lt: date },
        });
        rebateApplied = priorLateCount < MONTHLY_LATE_REBATES;
        lateRebatesUsed = rebateApplied ? priorLateCount + 1 : MONTHLY_LATE_REBATES;
      }
    }

    const newSession = {
      punchIn: punchInTime,
      ...(lat && lng ? { punchInLocation: { lat, lng } } : {}),
      ...(address   ? { punchInAddress: address }         : {}),
    };

    const setFields = {
      company: user.company || "Nutech International",
      shiftStart,
      shiftEnd,
    };
    if (isFirstPunch) {
      // A forgiven late arrival is still tentatively "present" — punch-out's
      // hours-worked check can still knock it down to half-day. An unforgiven
      // late arrival is locked to half-day regardless of hours worked.
      setFields.punchIn          = punchInTime;
      setFields.status           = late && !rebateApplied ? "half-day" : "present";
      setFields.lateArrival      = late;
      setFields.lateRebateApplied = late && rebateApplied;
      if (lat && lng) setFields.punchInLocation = { lat, lng };
      if (address)    setFields.punchInAddress  = address;
    }

    const record = await Attendance.findOneAndUpdate(
      { userId: user._id, date },
      { $set: setFields, $push: { sessions: newSession } },
      { upsert: true, new: true }
    );

    return res.json({
      message: "Punched in successfully.",
      attendance: record,
      lateRebatesUsed,
      lateRebatesRemaining: late ? Math.max(0, MONTHLY_LATE_REBATES - lateRebatesUsed) : null,
    });
  } catch (err) {
    console.error("punchIn error:", err.message);
    return res.status(500).json({ message: "Punch in failed.", error: err.message });
  }
};

// POST /api/attendance/punch-out
export const punchOut = async (req, res) => {
  try {
    const date = todayStr();
    const record = await Attendance.findOne({ userId: req.user.id, date });

    const lastSession = record?.sessions?.[record.sessions.length - 1];
    if (!record || !lastSession) {
      return res.status(400).json({ message: "You haven't punched in today." });
    }
    if (lastSession.punchOut) {
      return res.status(409).json({ message: "Already punched out. Punch in again to start a new session." });
    }

    const { lat, lng, address } = req.body;
    const punchOutTime = new Date();

    lastSession.punchOut = punchOutTime;
    if (lat && lng) lastSession.punchOutLocation = { lat, lng };
    if (address)    lastSession.punchOutAddress  = address;
    record.markModified("sessions");

    // Total worked time is the sum of every completed session today, not just this one.
    const totalMinutes = record.sessions.reduce(
      (sum, s) => (s.punchOut ? sum + Math.floor((s.punchOut - s.punchIn) / 60000) : sum),
      0
    );

    // Half of THIS employee's own shift length (snapshotted at punch-in), not a flat 4 hours.
    const halfDayMinutes = shiftDurationMinutes(record.shiftStart, record.shiftEnd) / 2;

    // An unforgiven late arrival is already locked to half-day at punch-in —
    // working full hours doesn't undo the lateness penalty.
    const lockedHalfDay = record.lateArrival && !record.lateRebateApplied;
    const status = lockedHalfDay ? "half-day" : (totalMinutes >= halfDayMinutes ? "present" : "half-day");

    record.punchOut     = punchOutTime;
    record.totalMinutes = totalMinutes;
    record.status       = status;
    if (lat && lng)  record.punchOutLocation = { lat, lng };
    if (address)     record.punchOutAddress  = address;
    await record.save();

    return res.json({ message: "Punched out successfully.", attendance: record });
  } catch (err) {
    console.error("punchOut error:", err.message);
    return res.status(500).json({ message: "Punch out failed.", error: err.message });
  }
};

// GET /api/attendance/today
export const getTodayAttendance = async (req, res) => {
  try {
    const date = todayStr();
    const record = await Attendance.findOne({ userId: req.user.id, date });
    return res.json({ attendance: record || null });
  } catch (err) {
    return res.status(500).json({ message: "Could not fetch attendance." });
  }
};

// GET /api/attendance/my-records
export const getMyAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({ userId: req.user.id })
      .sort({ date: -1 })
      .limit(30);
    return res.json({ records });
  } catch (err) {
    return res.status(500).json({ message: "Could not fetch records." });
  }
};

// GET /api/attendance/team  (manager sees their employees' attendance)
export const getTeamAttendance = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || todayStr();

    const employees = await User.find({ managerId: req.user.id }).select("_id name phone department");
    const employeeIds = employees.map((e) => e._id);

    const records = await Attendance.find({
      userId: { $in: employeeIds },
      date: targetDate,
    })
      .populate("userId", "name phone department company")
      .populate("locationViewLogs.viewedBy", "name");

    return res.json({ date: targetDate, records });
  } catch (err) {
    return res.status(500).json({ message: "Could not fetch team attendance." });
  }
};

// DELETE /api/attendance/clear-today
export const clearTodayAttendance = async (req, res) => {
  try {
    const date = todayStr();
    const result = await Attendance.deleteMany({ date });
    return res.json({ message: `Cleared ${result.deletedCount} attendance record(s) for today.` });
  } catch (err) {
    return res.status(500).json({ message: "Clear failed.", error: err.message });
  }
};

// PATCH /api/attendance/:id/regularize  (manager-only override)
export const regularizeAttendance = async (req, res) => {
  try {
    const { action, note } = req.body;
    if (!["full-day", "half-day", "reset"].includes(action)) {
      return res.status(400).json({ message: "action must be 'full-day', 'half-day', or 'reset'." });
    }
    // Resetting just reverts to the system's own computed status — nothing to
    // justify. Overriding it to full/half day is a manual judgment call, so
    // a reason is required for accountability.
    if (action !== "reset" && !note?.trim()) {
      return res.status(400).json({ message: "A reason is required to regularize attendance." });
    }

    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Attendance record not found." });

    if (action === "reset") {
      // Recompute what the system would have decided on its own, from the
      // facts already on the record — no separate "original status" needed.
      const lockedByLateness = record.lateArrival && !record.lateRebateApplied;
      const halfDayMinutes = shiftDurationMinutes(record.shiftStart, record.shiftEnd) / 2;
      record.status = lockedByLateness
        ? "half-day"
        : (record.totalMinutes != null ? (record.totalMinutes >= halfDayMinutes ? "present" : "half-day") : "present");
      record.regularized         = false;
      record.regularizedBy       = null;
      record.regularizedAt       = null;
      record.regularizationNote  = null;
    } else {
      record.status              = action === "full-day" ? "present" : "half-day";
      record.regularized         = true;
      record.regularizedBy       = req.user.id;
      record.regularizedAt       = new Date();
      record.regularizationNote  = note || null;
    }

    await record.save();
    const populated = await record.populate("regularizedBy", "name");
    return res.json({ message: "Attendance updated.", attendance: populated });
  } catch (err) {
    console.error("regularizeAttendance error:", err.message);
    return res.status(500).json({ message: "Could not update attendance.", error: err.message });
  }
};

// POST /api/attendance/:id/view-location  (manager-only)
// Logs who viewed this record's punch location and why, before the map is shown.
export const logLocationView = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return res.status(400).json({ message: "A reason is required to view location data." });
    }

    const record = await Attendance.findByIdAndUpdate(
      req.params.id,
      { $push: { locationViewLogs: { viewedBy: req.user.id, reason: reason.trim() } } },
      { new: true }
    ).populate("locationViewLogs.viewedBy", "name");

    if (!record) return res.status(404).json({ message: "Attendance record not found." });
    return res.json({ message: "Location view logged.", attendance: record });
  } catch (err) {
    return res.status(500).json({ message: "Could not log location view.", error: err.message });
  }
};

// GET /api/attendance/geocode?lat=X&lng=Y
export const geocodeLocation = async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ address: null });
  try {
    const url  = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_KEY}`;
    const { data } = await axios.get(url);
    console.log("Geocode status:", data.status, "error:", data.error_message);
    const address = data.results?.[0]?.formatted_address || null;
    return res.json({ address, status: data.status, error: data.error_message });
  } catch (err) {
    console.error("Geocode error:", err.message);
    return res.json({ address: null });
  }
};

// DELETE /api/attendance/clear-all
export const clearAllAttendance = async (req, res) => {
  try {
    const result = await Attendance.deleteMany({});
    return res.json({ message: `Cleared ${result.deletedCount} attendance record(s).` });
  } catch (err) {
    return res.status(500).json({ message: "Clear failed.", error: err.message });
  }
};

// GET /api/attendance/all  (all company attendance — for Manoj / admin)
export const getAllAttendance = async (req, res) => {
  try {
    const { date, company, startDate, endDate, year } = req.query;
    const filter = {};

    if (date) {
      filter.date = date;
    } else if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    } else if (year) {
      filter.date = { $gte: `${year}-01-01`, $lte: `${year}-12-31` };
    }

    if (company) filter.company = company;

    const records = await Attendance.find(filter)
      .populate("userId", "name phone department company role")
      .populate("locationViewLogs.viewedBy", "name")
      .sort({ date: -1 })
      .limit(500);

    return res.json({ records });
  } catch (err) {
    return res.status(500).json({ message: "Could not fetch attendance." });
  }
};

// GET /api/attendance/sunday-status?userId=X&month=YYYY-MM
// For every Sunday in the given month, reports whether that employee worked
// enough hours Mon–Sat that week (>= 4.5 of their own shift-length days) to
// have earned Sunday as a paid holiday. Flag only — nothing is auto-marked.
export const getSundayStatus = async (req, res) => {
  try {
    const { userId, month } = req.query;
    if (!userId || !month) {
      return res.status(400).json({ message: "userId and month (YYYY-MM) are required." });
    }

    const user = await User.findById(userId).select("shiftStart shiftEnd");
    if (!user) return res.status(404).json({ message: "User not found." });
    const requiredMinutes = SUNDAY_HOLIDAY_DAYS * shiftDurationMinutes(user.shiftStart, user.shiftEnd);

    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

    const sundayDays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0) sundayDays.push(d);
    }

    const sundays = [];
    for (const day of sundayDays) {
      const weekStart = fmtDate(new Date(Date.UTC(y, m - 1, day - 6))); // Monday
      const weekEnd   = fmtDate(new Date(Date.UTC(y, m - 1, day - 1))); // Saturday

      const weekRecords = await Attendance.find({
        userId,
        date: { $gte: weekStart, $lte: weekEnd },
      });
      const weekMinutes = weekRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);

      sundays.push({
        date: fmtDate(new Date(Date.UTC(y, m - 1, day))),
        weekStart,
        weekEnd,
        weekHours: Math.round((weekMinutes / 60) * 100) / 100,
        requiredHours: Math.round((requiredMinutes / 60) * 100) / 100,
        earned: weekMinutes >= requiredMinutes,
      });
    }

    return res.json({ sundays });
  } catch (err) {
    return res.status(500).json({ message: "Could not compute Sunday eligibility.", error: err.message });
  }
};
