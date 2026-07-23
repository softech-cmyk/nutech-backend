import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";
import Holiday from "../models/Holiday.js";
import { todayStr, parseTimeToMinutes } from "../utils/attendanceTime.js";

export const ABSENT_CUTOFF = "12:30";

// Marks every employee who hasn't punched in by the cutoff as absent for
// today, skipping: Sundays, company holidays, anyone already on approved
// leave today, anyone whose shift doesn't start until after the cutoff, and
// anyone who already has a record for today (punched in, or already marked).
export const runAutoAbsentCheck = async () => {
  const date = todayStr();

  if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) {
    return { date, skipped: "sunday", marked: 0 };
  }

  const holiday = await Holiday.findOne({ date });
  if (holiday) {
    return { date, skipped: "holiday", holidayName: holiday.name, marked: 0 };
  }

  const cutoffMinutes = parseTimeToMinutes(ABSENT_CUTOFF);
  const users = await User.find({}, "name company shiftStart shiftEnd");

  let marked = 0;
  for (const user of users) {
    if (parseTimeToMinutes(user.shiftStart) > cutoffMinutes) continue;

    const existing = await Attendance.findOne({ userId: user._id, date });
    if (existing) continue;

    const onLeave = await Leave.findOne({
      userId: user._id,
      status: "approved",
      startDate: { $lte: date },
      endDate: { $gte: date },
    });
    if (onLeave) continue;

    try {
      await Attendance.create({
        userId: user._id,
        company: user.company || "Nutech International",
        date,
        status: "absent",
        shiftStart: user.shiftStart || "10:00",
        shiftEnd: user.shiftEnd || "18:30",
        regularized: true,
        regularizedAt: new Date(),
        regularizationNote: `Auto-marked absent — no punch-in by ${ABSENT_CUTOFF}.`,
      });
      marked += 1;
    } catch (err) {
      // Duplicate key (E11000) means the employee punched in between our
      // findOne check and this create — not an error, just a race we lost.
      if (err.code !== 11000) throw err;
    }
  }

  return { date, marked, totalChecked: users.length };
};
