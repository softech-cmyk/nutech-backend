// One-off migration: recompute lateArrival / lateRebateApplied / status for
// existing attendance records against the current rules —
//   - late arrival = punched in any time after shift start (grace window was
//     just reduced from 15 minutes to 0), or after the absolute 12:30 cutoff
//   - the 4th+ late arrival in a calendar month (rebate quota is 3) is now
//     locked to a full "absent" day, not "half-day"
// Since tightening the grace window changes which days count as late, it also
// shifts the monthly rebate count, so this walks each employee's records in
// date order and replays the same sequence the app applies at punch-in time.
// Manually regularized records are left untouched.
//
// Usage:
//   node _recompute_late_status.mjs                 # dry run, August 2026 only
//   node _recompute_late_status.mjs --apply          # actually update
//   node _recompute_late_status.mjs --apply --from=2026-01-01 --to=2026-12-31
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Attendance from "./src/models/Attendance.js";
import "./src/models/User.js";
import { isLateArrival, shiftDurationMinutes } from "./src/utils/attendanceTime.js";

const MONTHLY_LATE_REBATES = 3;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const getArg = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};
const from = getArg("from", "2026-08-01");
const to   = getArg("to",   "2026-08-31");

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(`Connected. Recomputing ${from}..${to} (${apply ? "APPLY" : "DRY RUN"})\n`);

  const records = await Attendance.find({ date: { $gte: from, $lte: to } })
    .populate("userId", "name")
    .sort({ userId: 1, date: 1 });

  let changed = 0;
  const lateCountByMonthUser = new Map(); // "userId:YYYY-MM" -> count of confirmed-late days so far

  for (const r of records) {
    if (!r.punchIn || r.regularized) continue; // no punch-in, or a manager's manual call — leave alone

    const shiftStart = r.shiftStart || "10:00";
    const late = isLateArrival(r.punchIn, shiftStart);

    let rebateApplied = false;
    if (late) {
      const key = `${r.userId?._id || r.userId}:${r.date.slice(0, 7)}`;
      const priorLateCount = lateCountByMonthUser.get(key) || 0;
      rebateApplied = priorLateCount < MONTHLY_LATE_REBATES;
      lateCountByMonthUser.set(key, priorLateCount + 1);
    }

    let status;
    if (late && !rebateApplied) {
      status = "absent";
    } else if (r.punchOut) {
      const halfDayMinutes = shiftDurationMinutes(r.shiftStart, r.shiftEnd) / 2;
      status = r.totalMinutes >= halfDayMinutes ? "present" : "half-day";
    } else {
      status = "present"; // still on-duty / open session, tentative
    }

    if (r.lateArrival !== late || r.lateRebateApplied !== rebateApplied || r.status !== status) {
      console.log(
        `${r.userId?.name || r.userId} | ${r.date} | ` +
        `lateArrival ${r.lateArrival}->${late}, rebate ${r.lateRebateApplied}->${rebateApplied}, ` +
        `status ${r.status}->${status}`
      );
      changed += 1;
      if (apply) {
        r.lateArrival = late;
        r.lateRebateApplied = rebateApplied;
        r.status = status;
        await r.save();
      }
    }
  }

  console.log(`\n${changed} record(s) ${apply ? "updated" : "would be updated"}.`);
  await mongoose.disconnect();
};

run().catch((err) => { console.error(err); process.exit(1); });
