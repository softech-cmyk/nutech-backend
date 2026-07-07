import bcrypt from "bcryptjs";
import User from "../models/User.js";

// GET /api/users/all — all users, company-wide (manager only)
export const getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }
    const users = await User.find().select("_id name phone countryCode department company role createdAt").sort({ createdAt: -1 });
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ message: "Could not fetch users." });
  }
};

// GET /api/users/managers — all managers with department (public, used in signup dropdown)
export const getManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: "manager" }).select("_id name phone department");
    return res.json({ managers });
  } catch (err) {
    return res.status(500).json({ message: "Could not fetch managers." });
  }
};

// GET /api/users/:id — public profile (name, phone, department, role)
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("_id name phone department role");
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ message: "Could not fetch user." });
  }
};

// GET /api/users/my-employees — employees under the logged-in manager
export const getMyEmployees = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }
    const employees = await User.find({ managerId: req.user.id }).select("-password");
    return res.json({ employees });
  } catch (err) {
    return res.status(500).json({ message: "Could not fetch employees." });
  }
};

// PATCH /api/users/:id/promote — promote a user to manager
export const promoteToManager = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: "manager", managerId: null },
      { new: true }
    ).select("-password");
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.json({ message: "User promoted to manager.", user });
  } catch (err) {
    return res.status(500).json({ message: "Could not promote user." });
  }
};

// PATCH /api/users/:id/assign-manager — assign an employee to a manager
export const assignManager = async (req, res) => {
  try {
    const { managerId } = req.body;
    if (!managerId) return res.status(400).json({ message: "managerId is required." });

    const manager = await User.findById(managerId);
    if (!manager || manager.role !== "manager") {
      return res.status(400).json({ message: "Invalid manager." });
    }

    const employee = await User.findByIdAndUpdate(
      req.params.id,
      { managerId },
      { new: true }
    ).select("-password");
    if (!employee) return res.status(404).json({ message: "Employee not found." });

    return res.json({ message: "Manager assigned.", employee });
  } catch (err) {
    return res.status(500).json({ message: "Could not assign manager." });
  }
};

// PATCH /api/users/:id/reset-password — manager-only. Sets a new password directly.
export const resetPassword = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    user.password = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    await user.save();

    return res.json({ message: `Password reset for ${user.name || user.phone}.` });
  } catch (err) {
    return res.status(500).json({ message: "Could not reset password.", error: err.message });
  }
};
