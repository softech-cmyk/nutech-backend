import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Helper: sign a JWT for a user
const signToken = (user, role = user.role) =>
  jwt.sign({ id: user._id, phone: user.phone, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

// Helper: random 12-char temp password, shown to the admin exactly once
const generateTempPassword = () => crypto.randomBytes(9).toString("base64url");

// 1) CREATE EMPLOYEE — manager-only. Generates the account + a one-time temp password.
export const createEmployee = async (req, res) => {
  try {
    const { name, phone, countryCode = "+91", role = "employee", department, company = "Nutech International" } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone number are required." });
    }
    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ message: "Enter a valid 10-digit phone number." });
    }
    if (!["employee", "manager"].includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }
    if (!department) {
      return res.status(400).json({ message: "Please select a department." });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(409).json({ message: "An account with this number already exists." });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await User.create({
      name,
      phone,
      countryCode,
      password: passwordHash,
      isVerified: true,
      role,
      department,
      company,
      managerId: role === "employee" ? req.user.id : null,
      mustChangePassword: true,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      message: "Employee account created.",
      tempPassword,
      user: { id: user._id, name: user.name, phone: user.phone, countryCode: user.countryCode, role: user.role, department: user.department },
    });
  } catch (err) {
    console.error("createEmployee error:", err.message);
    return res.status(500).json({ message: "Could not create employee.", error: err.message });
  }
};

// 2) LOGIN — phone + password
export const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone number and password are required." });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ message: "No account found with this phone number." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    const token = signToken(user, user.role);
    return res.json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        countryCode: user.countryCode,
        role: user.role,
        managerId: user.managerId,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    console.error("login error:", err.message);
    return res.status(500).json({ message: "Login failed. Try again." });
  }
};

// 3) CHANGE PASSWORD — required on first login after an admin creates the account
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    await user.save();

    return res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("changePassword error:", err.message);
    return res.status(500).json({ message: "Could not update password." });
  }
};

// 4) ME — returns the logged-in user (protected route, unchanged)
export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ message: "Something went wrong." });
  }
};
