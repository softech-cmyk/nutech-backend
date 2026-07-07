import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";

const MONGO_URI =
  "mongodb+srv://softech_db_user:hHM3e2c3uJ74zAt6@cluster01.wmts014.mongodb.net/attendanceDB?retryWrites=true&w=majority&appName=Cluster01";

await mongoose.connect(MONGO_URI);
console.log("Connected.");

const a = await mongoose.connection.collection("attendances").deleteMany({});
const l = await mongoose.connection.collection("leaves").deleteMany({});

console.log(`Deleted ${a.deletedCount} attendance record(s).`);
console.log(`Deleted ${l.deletedCount} leave record(s).`);

await mongoose.disconnect();
console.log("Done.");
