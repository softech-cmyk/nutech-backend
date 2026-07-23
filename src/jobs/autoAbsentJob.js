import cron from "node-cron";
import { runAutoAbsentCheck } from "../services/autoAbsent.js";

// Runs every day at 12:30 PM IST, regardless of the server's own timezone.
export const startAutoAbsentJob = () => {
  cron.schedule(
    "30 12 * * *",
    async () => {
      try {
        const result = await runAutoAbsentCheck();
        console.log("🕧 Auto-absent check:", result);
      } catch (err) {
        console.error("Auto-absent check failed:", err.message);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
};
