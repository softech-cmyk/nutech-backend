import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// userId -> { userId, name, lat, lng, updatedAt }
const liveLocations = new Map();

export const getLiveLocations = () => Array.from(liveLocations.values());

export const initSocket = (httpServer, allowedOrigins) => {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
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
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Not authorized. No token."));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("name role");
      if (!user) return next(new Error("User not found."));
      socket.user = { id: decoded.id, role: decoded.role, name: user.name || "Employee" };
      next();
    } catch (err) {
      next(new Error("Invalid or expired token."));
    }
  });

  io.on("connection", (socket) => {
    const { id: userId, role, name } = socket.user;

    if (role === "manager") {
      socket.join("managers");
      // Send the current snapshot on connect so the dashboard doesn't have
      // to wait for the next employee ping to populate the map.
      socket.emit("location:snapshot", getLiveLocations());
    }

    socket.on("location:update", ({ lat, lng }) => {
      if (role !== "employee") return;
      if (typeof lat !== "number" || typeof lng !== "number") return;

      const entry = { userId, name, lat, lng, updatedAt: new Date().toISOString() };
      liveLocations.set(userId, entry);
      io.to("managers").emit("location:update", entry);
    });

    socket.on("location:stop", () => {
      if (liveLocations.delete(userId)) {
        io.to("managers").emit("location:offline", { userId });
      }
    });

    socket.on("disconnect", () => {
      if (role === "employee" && liveLocations.delete(userId)) {
        io.to("managers").emit("location:offline", { userId });
      }
    });
  });

  return io;
};
