import cron from "node-cron";
import Attendance from "../models/Attendance.js";
import { sendPushToUser } from "../utils/webPush.js";
import {
  todayStr,
  parseTimeToMinutes,
  istMinutesOfDay,
  computePunchOutStatus,
} from "../utils/attendanceTime.js";

export const runAutoPunchOut = async () => {
  const date = todayStr();
  const nowMinutes = istMinutesOfDay();

  const openRecords = await Attendance.find({ date, "sessions.punchOut": null });

  for (const record of openRecords) {
    const lastSession = record.sessions[record.sessions.length - 1];
    if (!lastSession || lastSession.punchOut) continue;

    const shiftEndMinutes = parseTimeToMinutes(record.shiftEnd, "18:30");
    if (nowMinutes < shiftEndMinutes) continue;

    const punchOutTime = new Date();
    lastSession.punchOut = punchOutTime;
    lastSession.autoPunchOut = true;
    record.markModified("sessions");

    const totalMinutes = record.sessions.reduce(
      (sum, s) => (s.punchOut ? sum + Math.floor((s.punchOut - s.punchIn) / 60000) : sum),
      0
    );
    record.punchOut = punchOutTime;
    record.totalMinutes = totalMinutes;
    record.status = computePunchOutStatus(record, totalMinutes);
    record.autoPunchOut = true;

    try {
      await record.save();
      sendPushToUser(record.userId, {
        title: "Auto punched out",
        body: `You were automatically punched out at the end of your shift (${record.shiftEnd}).`,
        url: "/EmployeeDashboard",
      });
    } catch (err) {
      console.error("Auto punch-out failed for record", record._id, err.message);
    }
  }
};

export const startAutoPunchOutJob = () => {
  cron.schedule("*/5 * * * *", runAutoPunchOut);
  console.log("Auto punch-out job scheduled (every 5 minutes).");
};
