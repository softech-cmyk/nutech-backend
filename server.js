import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import express from "express";
import { createServer } from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import attendanceRoutes from "./src/routes/attendanceRoutes.js";
import leaveRoutes from "./src/routes/leaveRoutes.js";
import holidayRoutes from "./src/routes/holidayRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";
import payrollRoutes from "./src/routes/payrollRoutes.js";
import { initSocket } from "./src/socket/index.js";


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

// Also stash the raw request body — the RazorpayX webhook needs the exact
// bytes (not the re-serialized object) to verify its HMAC signature.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

const httpServer = createServer(app);
initSocket(httpServer, allowedOrigins);


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payroll", payrollRoutes);


// Serve the website (React build)
app.use(express.static(path.join(__dirname, "public")));

app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
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
    httpServer.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
};

startServer();