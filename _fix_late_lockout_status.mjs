// One-off migration: recompute status for existing attendance records that
// were locked "half-day" by an unforgiven late arrival (monthly rebate quota
// already used up), so they reflect the new rule of full-day "absent"
// instead. Only touches records the system computed on its own — a manager's
// manual regularization is left untouched.
//
// Usage:
//   node _fix_late_lockout_status.mjs                  # dry run, August 2026 only
//   node _fix_late_lockout_status.mjs --apply           # actually update, August 2026 only
//   node _fix_late_lockout_status.mjs --apply --from=2026-01-01 --to=2026-12-31
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Attendance from "./src/models/Attendance.js";
import "./src/models/User.js";

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
  console.log(`Connected. Scanning ${from}..${to} (${apply ? "APPLY" : "DRY RUN"})\n`);

  const records = await Attendance.find({
    date: { $gte: from, $lte: to },
    status: "half-day",
    lateArrival: true,
    lateRebateApplied: false,
    regularized: { $ne: true },
  }).populate("userId", "name");

  if (!records.length) {
    console.log("No matching records found.");
  } else {
    for (const r of records) {
      console.log(`${r.userId?.name || r.userId} | ${r.date} | half-day -> absent`);
      if (apply) {
        r.status = "absent";
        await r.save();
      }
    }
    console.log(`\n${records.length} record(s) ${apply ? "updated" : "would be updated"}.`);
  }

  await mongoose.disconnect();
};

run().catch((err) => { console.error(err); process.exit(1); });
