// One-time bootstrap: loads the 2026 holiday calendar.
// Run once: node seedHolidays.js
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import dotenv from "dotenv";
import Holiday from "./src/models/Holiday.js";

dotenv.config();

const HOLIDAYS_2026 = [
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-02-15", name: "Maha Shivaratri" },
  { date: "2026-03-04", name: "Holi" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-08-28", name: "Raksha Bandhan" },
  { date: "2026-09-04", name: "Janmashtami" },
  { date: "2026-10-02", name: "Mahatma Gandhi Jayanti" },
  { date: "2026-10-20", name: "Dussehra" },
  { date: "2026-11-08", name: "Diwali/Deepavali" },
];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  for (const h of HOLIDAYS_2026) {
    await Holiday.findOneAndUpdate({ date: h.date }, h, { upsert: true });
    console.log(`Upserted ${h.date} — ${h.name}`);
  }

  console.log(`Done. ${HOLIDAYS_2026.length} holiday(s) loaded for 2026.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
