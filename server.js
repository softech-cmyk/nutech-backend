import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import attendanceRoutes from "./src/routes/attendanceRoutes.js";
import leaveRoutes from "./src/routes/leaveRoutes.js";
import holidayRoutes from "./src/routes/holidayRoutes.js";


// Load environment variables
dotenv.config();


const app = express();


// Middlewares
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((url) => url.trim());

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow non-browser requests (no origin header), exact matches,
            // and any Vercel preview deployment of this frontend project.
            if (
                !origin ||
                allowedOrigins.includes(origin) ||
                /^https:\/\/attendance-system-frontend[a-z0-9-]*\.vercel\.app$/.test(origin)
            ) {
                callback(null, true);
            } else {
                callback(new Error(`Not allowed by CORS: ${origin}`));
            }
        },
        credentials: true,
    })
);

app.use(express.json());


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/holidays", holidayRoutes);


// Test Route
app.get("/", (req, res) => {
    res.send("Nutech Attendance API Running");
});


// MongoDB Connection
const connectDB = async () => {
    try {

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
        });

        console.log("✅ MongoDB Connected Successfully");

        // Drop stale email_1 unique index if it exists
        try {
            await mongoose.connection.collection("users").dropIndex("email_1");
            console.log("🗑️  Dropped stale email_1 index");
        } catch (_) {
            // Index doesn't exist — nothing to do
        }

    } catch (error) {

        console.log("❌ MongoDB Connection Error:", error.message);
        process.exit(1);

    }
};


// Start server only after DB connects
const startServer = async () => {
    await connectDB();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
};

startServer();