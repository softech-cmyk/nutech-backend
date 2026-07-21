import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  leaveType: {
    type: String,
    enum: ["CL", "SL", "EL", "PWL"],
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  startDate: {
    type: String,
    required: true,
  },
  endDate: {
    type: String,
    required: true,
  },
  // Only valid for a single-day leave (startDate === endDate) — counts as
  // 0.5 day against quota/payroll instead of a full day.
  isHalfDay: {
    type: Boolean,
    default: false,
  },
  // Which half the employee is away for, and the specific clock time that
  // marks the boundary — e.g. "first-half" + "13:00" means they'll be in
  // from 1pm; "second-half" + "13:00" means they're leaving at 1pm.
  halfDaySession: {
    type: String,
    enum: ["first-half", "second-half", null],
    default: null,
  },
  halfDayTime: {
    type: String, // "HH:mm", 24-hour
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  rejectionReason: {
    type: String,
    default: null,
  },
}, { timestamps: true });

export default mongoose.model("Leave", leaveSchema);
