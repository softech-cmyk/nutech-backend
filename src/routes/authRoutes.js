import express from "express";
import rateLimit from "express-rate-limit";
import {
  createEmployee,
  login,
  changePassword,
  me,
} from "../controllers/authController.js";
import { protect, requireManager } from "../middleware/auth.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts. Try again later." },
});

router.post("/login", loginLimiter, login);
router.post("/create-employee", protect, requireManager, createEmployee);
router.post("/change-password", protect, changePassword);
router.get("/me", protect, me);

export default router;
