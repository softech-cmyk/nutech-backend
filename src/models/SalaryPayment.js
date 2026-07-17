import mongoose from "mongoose";

// A snapshot of a payroll calculation at the moment it was paid — kept
// separate from the live computation so a later attendance correction can't
// silently rewrite a month that's already been paid out.
const salaryPaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  month: {
    type: String, // "YYYY-MM"
    required: true,
  },
  monthlySalary: { type: Number, required: true },
  workingDaysInMonth: { type: Number, required: true },
  presentDays: { type: Number, required: true },
  halfDays: { type: Number, required: true },
  absentDays: { type: Number, required: true },
  paidLeaveDays: { type: Number, required: true },
  unpaidLeaveDays: { type: Number, required: true },
  perDayRate: { type: Number, required: true },
  deduction: { type: Number, required: true },
  netSalary: { type: Number, required: true },
  // Further optional deductions on top of netSalary — whatever was set on
  // the employee at the moment this was paid.
  esi: { type: Number, default: null },
  pf: { type: Number, default: null },
  bonus: { type: Number, default: null },
  gratuity: { type: Number, default: null },
  // netSalary minus esi/pf/bonus/gratuity — the amount actually credited.
  finalNetSalary: { type: Number, required: true },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // "manual" = a manager marked this paid directly (cash/cheque/other channel).
  // "razorpayx" = an actual bank transfer was initiated through RazorpayX.
  payoutMode: {
    type: String,
    enum: ["manual", "razorpayx"],
    default: "manual",
  },
  // For manual payments this is "recorded" the moment it's created. For
  // RazorpayX payments it starts "queued"/"processing" and is flipped to
  // "processed"/"failed"/"reversed" by the webhook once the bank responds.
  payoutStatus: {
    type: String,
    enum: ["recorded", "queued", "processing", "processed", "reversed", "failed"],
    default: "recorded",
  },
  razorpayPayoutId: {
    type: String,
    default: null,
  },
  failureReason: {
    type: String,
    default: null,
  },
  paidAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// One payment record per user per month
salaryPaymentSchema.index({ userId: 1, month: 1 }, { unique: true });

export default mongoose.model("SalaryPayment", salaryPaymentSchema);
