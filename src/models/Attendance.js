import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  company: {
    type: String,
    enum: ["Nutech International", "SPL Technologies", "Both"],
    required: true,
  },
  date: {
    type: String,   // "YYYY-MM-DD" — one record per user per day
    required: true,
  },
  punchIn: {
    type: Date,
    default: null,
  },
  punchOut: {
    type: Date,
    default: null,
  },
  totalMinutes: {
    type: Number,
    default: null,
  },
  punchInLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  punchOutLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  punchInAddress:  { type: String, default: null },
  punchOutAddress: { type: String, default: null },
  status: {
    type: String,
    enum: ["present", "half-day", "absent"],
    default: "present",
  },
  lateArrival: {
    type: Boolean,
    default: false,
  },
  lateRebateApplied: {
    type: Boolean,
    default: false,
  },
  regularized: {
    type: Boolean,
    default: false,
  },
  regularizedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  regularizedAt: {
    type: Date,
    default: null,
  },
  regularizationNote: {
    type: String,
    default: null,
  },
}, { timestamps: true });

// One record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
