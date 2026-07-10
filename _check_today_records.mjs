import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Attendance from "./src/models/Attendance.js";
import "./src/models/User.js";

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected\n");

  const today = new Date().toISOString().slice(0, 10);
  const records = await Attendance.find({ date: today }).populate("userId", "name");

  records.forEach((r) => {
    console.log(`--- ${r.userId?.name} (${r.date}) ---`);
    console.log("punchInLocation:", JSON.stringify(r.punchInLocation));
    console.log("punchInAddress:", r.punchInAddress);
    console.log("punchOutLocation:", JSON.stringify(r.punchOutLocation));
    console.log("punchOutAddress:", r.punchOutAddress);
    console.log("sessions[0]:", JSON.stringify(r.sessions[0]));
    console.log();
  });

  console.log("GOOGLE_MAPS_KEY set:", !!process.env.GOOGLE_MAPS_KEY, "length:", (process.env.GOOGLE_MAPS_KEY || "").length);

  await mongoose.disconnect();
};

run().catch((err) => { console.error(err); process.exit(1); });
