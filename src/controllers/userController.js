import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";
import SalaryPayment from "../models/SalaryPayment.js";

// GET /api/users/all — all users, company-wide (manager only)
export const getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }
    const users = await User.find().select("_id name phone countryCode department company role createdAt monthlySalary salaryAdjustments").sort({ createdAt: -1 });
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
    const employees = await User.find({ managerId: req.user.id }).select("-password -bankAccount.accountNumber");
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

// PATCH /api/users/:id/salary — manager-only. Sets the employee's gross monthly salary.
export const updateSalary = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    const { monthlySalary } = req.body;
    if (monthlySalary === undefined || monthlySalary === null || monthlySalary === "" || isNaN(monthlySalary) || Number(monthlySalary) < 0) {
      return res.status(400).json({ message: "Enter a valid, non-negative monthly salary." });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { monthlySalary: Number(monthlySalary) },
      { new: true }
    ).select("-password -bankAccount.accountNumber");
    if (!user) return res.status(404).json({ message: "User not found." });

    return res.json({ message: "Salary updated.", user });
  } catch (err) {
    return res.status(500).json({ message: "Could not update salary.", error: err.message });
  }
};

// PATCH /api/users/:id/phone — manager-only. Updates an employee's phone number.
export const updatePhone = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    const phone = req.body.phone?.trim();
    const countryCode = req.body.countryCode?.trim() || "+91";
    if (!phone || !/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ message: "Enter a valid 10-digit phone number." });
    }

    const clash = await User.findOne({ phone, _id: { $ne: req.params.id } });
    if (clash) {
      return res.status(409).json({ message: "Another account already uses this phone number." });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { phone, countryCode },
      { new: true }
    ).select("-password -bankAccount.accountNumber");
    if (!user) return res.status(404).json({ message: "User not found." });

    return res.json({ message: "Phone number updated.", user });
  } catch (err) {
    return res.status(500).json({ message: "Could not update phone number.", error: err.message });
  }
};

// PATCH /api/users/:id/salary-adjustments — manager-only. Optional further
// deductions (ESI, PF, bonus, gratuity) applied on top of the attendance-based
// net salary. None are required — any field left out is cleared to null.
export const updateSalaryAdjustments = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    const fields = ["esi", "pf", "bonus", "gratuity"];
    const salaryAdjustments = {};
    for (const key of fields) {
      const val = req.body[key];
      if (val === undefined || val === null || val === "") {
        salaryAdjustments[key] = null;
        continue;
      }
      if (isNaN(val) || Number(val) < 0) {
        return res.status(400).json({ message: `Enter a valid, non-negative ${key.toUpperCase()}.` });
      }
      salaryAdjustments[key] = Number(val);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { salaryAdjustments },
      { new: true }
    ).select("-password -bankAccount.accountNumber");
    if (!user) return res.status(404).json({ message: "User not found." });

    return res.json({ message: "Adjustments saved.", user });
  } catch (err) {
    return res.status(500).json({ message: "Could not save adjustments.", error: err.message });
  }
};

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// GET /api/users/:id/bank-account — manager-only. Returns a masked view, never the full number.
export const getBankAccount = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    const user = await User.findById(req.params.id).select("bankAccount");
    if (!user) return res.status(404).json({ message: "User not found." });

    const ba = user.bankAccount;
    if (!ba?.accountNumber) return res.json({ bankAccount: null });

    return res.json({
      bankAccount: {
        accountHolderName: ba.accountHolderName,
        accountNumberMasked: `•••• ${ba.accountNumber.slice(-4)}`,
        ifsc: ba.ifsc,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Could not fetch bank details.", error: err.message });
  }
};

// PATCH /api/users/:id/bank-account — manager-only. Sets/updates the employee's payout bank account.
export const updateBankAccount = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    const accountHolderName = req.body.accountHolderName?.trim();
    const accountNumber = req.body.accountNumber?.trim();
    const ifsc = req.body.ifsc?.trim().toUpperCase();

    if (!accountHolderName || !accountNumber || !ifsc) {
      return res.status(400).json({ message: "Account holder name, account number, and IFSC are all required." });
    }
    if (!/^[0-9]{6,20}$/.test(accountNumber)) {
      return res.status(400).json({ message: "Enter a valid account number." });
    }
    if (!IFSC_RE.test(ifsc)) {
      return res.status(400).json({ message: "Enter a valid IFSC code." });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    // If the actual account changed, drop the cached RazorpayX fund account —
    // the next payout will create a fresh one against the new details.
    const changed = user.bankAccount?.accountNumber !== accountNumber || user.bankAccount?.ifsc !== ifsc;

    user.bankAccount = {
      accountHolderName,
      accountNumber,
      ifsc,
      razorpayContactId: changed ? null : user.bankAccount?.razorpayContactId || null,
      razorpayFundAccountId: changed ? null : user.bankAccount?.razorpayFundAccountId || null,
    };
    await user.save();

    return res.json({
      message: "Bank details saved.",
      bankAccount: {
        accountHolderName,
        accountNumberMasked: `•••• ${accountNumber.slice(-4)}`,
        ifsc,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Could not save bank details.", error: err.message });
  }
};

// DELETE /api/users/:id — manager-only. Permanently removes the employee
// along with all their attendance, leave, and payroll history. Irreversible.
export const deleteUser = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "You can't delete your own account." });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    await Promise.all([
      Attendance.deleteMany({ userId: user._id }),
      Leave.deleteMany({ userId: user._id }),
      SalaryPayment.deleteMany({ userId: user._id }),
      // Any employees who reported to this manager are left unassigned, not orphaned.
      User.updateMany({ managerId: user._id }, { managerId: null }),
    ]);
    await user.deleteOne();

    return res.json({ message: `${user.name || user.phone} and all their records were deleted.` });
  } catch (err) {
    return res.status(500).json({ message: "Could not delete employee.", error: err.message });
  }
};
