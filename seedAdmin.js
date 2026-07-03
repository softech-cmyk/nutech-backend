// One-time bootstrap: creates the first manager account so someone can
// log in and start using /api/auth/create-employee to onboard everyone else.
// Run once: node seedAdmin.js
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js";

dotenv.config();

const run = async () => {
  const phone = (process.env.ADMIN_PHONE || "").replace(/[^0-9]/g, "");
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin";
  const department = process.env.ADMIN_DEPARTMENT || "Operations";

  if (!phone || !password) {
    console.error("Set ADMIN_PHONE and ADMIN_PASSWORD in .env before running this script.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  const existing = await User.findOne({ phone });
  if (existing) {
    console.log(`A user with phone ${phone} already exists (role: ${existing.role}). Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    name,
    phone,
    password: passwordHash,
    isVerified: true,
    role: "manager",
    department,
    mustChangePassword: true,
  });

  console.log(`Manager account created for ${phone}. Log in and change the password immediately — it's set from ADMIN_PASSWORD in .env.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
