import express from "express";
import {
  getAllUsers,
  getManagers,
  getUserById,
  getMyEmployees,
  promoteToManager,
  assignManager,
  resetPassword,
  updateSalary,
  updateSalaryAdjustments,
  getBankAccount,
  updateBankAccount,
  deleteUser,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/all", protect, getAllUsers);
router.get("/managers", getManagers);                          // public
router.get("/my-employees", protect, getMyEmployees);          // manager only
router.get("/:id", protect, getUserById);                      // get any user by id
router.patch("/:id/promote", protect, promoteToManager);       // promote to manager
router.patch("/:id/assign-manager", protect, assignManager);   // assign employee to manager
router.patch("/:id/reset-password", protect, resetPassword);   // manager only
router.patch("/:id/salary", protect, updateSalary);             // manager only
router.patch("/:id/salary-adjustments", protect, updateSalaryAdjustments); // manager only
router.get("/:id/bank-account", protect, getBankAccount);       // manager only, masked
router.patch("/:id/bank-account", protect, updateBankAccount);  // manager only
router.delete("/:id", protect, deleteUser);                      // manager only

export default router;
