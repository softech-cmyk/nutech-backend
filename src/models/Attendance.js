import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  company: {
    type: String,
    enum: ["Nutech International", "SPL Technologies"],
    required: true,
  },
  date: {
    type: String,   // "YYYY-MM-DD" — one record per user per day
    required: true,
  },
  // Aggregate across the day's sessions: first punch-in, latest punch-out,
  // and their locations — kept at the top level so existing reports/exports/
  // location views that expect a single in/out pair keep working unchanged.
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
  // An employee can punch in/out multiple times a day (e.g. stepping out and
  // coming back) — each cycle is its own session; totalMinutes above sums them.
  sessions: {
    type: [{
      punchIn:  { type: Date, required: true },
      punchOut: { type: Date, default: null },
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
    }],
    default: [],
  },
  // Snapshot of the employee's shift at punch-in time, so late-arrival/half-day
  // rules stay consistent for this record even if their shift changes later.
  shiftStart: { type: String, default: "10:00" },
  shiftEnd:   { type: String, default: "18:30" },
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
  // Audit trail: every time a manager opens this record's location map, we log
  // who looked and why — location data is sensitive, so access is accountable.
  locationViewLogs: {
    type: [{
      viewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      viewedAt: { type: Date, default: Date.now },
      reason:   { type: String, required: true },
    }],
    default: [],
  },
}, { timestamps: true });

// One record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
