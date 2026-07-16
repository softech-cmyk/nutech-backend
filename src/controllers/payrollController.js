import crypto from "crypto";
import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";
import Holiday from "../models/Holiday.js";
import SalaryPayment from "../models/SalaryPayment.js";
import { createContact, createFundAccount, createPayout } from "../utils/razorpayx.js";

const pad2 = (n) => String(n).padStart(2, "0");
const round2 = (n) => Math.round(n * 100) / 100;

const currentMonthStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
};

// Computes this month's gross/deduction/net pay for the given users, from
// attendance + approved leave so far.
//
// Rule: per-day rate = gross ÷ working days in the month (Sundays and
// holidays excluded). A working day that has already passed counts as a
// deduction (1 day) unless it has a "present" attendance record or falls
// inside an approved leave; a "half-day" attendance record deducts 0.5 day.
// Future working days aren't judged yet, but still count toward the divisor.
const computeMonthPayroll = async (users) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const today = now.getDate();
  const monthStr = `${year}-${pad2(month)}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = `${monthStr}-01`;
  const monthEnd = `${monthStr}-${pad2(daysInMonth)}`;

  const holidays = await Holiday.find({ date: { $gte: monthStart, $lte: monthEnd } }).select("date");
  const holidaySet = new Set(holidays.map((h) => h.date));

  const workingDates = [];
  const elapsedWorkingDates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthStr}-${pad2(d)}`;
    const isSunday = new Date(year, month - 1, d).getDay() === 0;
    if (isSunday || holidaySet.has(dateStr)) continue;
    workingDates.push(dateStr);
    if (d <= today) elapsedWorkingDates.push(dateStr);
  }

  const userIds = users.map((u) => u._id);

  const attendanceRecords = await Attendance.find({
    userId: { $in: userIds },
    date: { $gte: monthStart, $lte: monthEnd },
  }).select("userId date status");
  const attendanceByUser = {};
  for (const rec of attendanceRecords) {
    const uid = String(rec.userId);
    (attendanceByUser[uid] ||= {})[rec.date] = rec.status;
  }

  const approvedLeaves = await Leave.find({
    userId: { $in: userIds },
    status: "approved",
    startDate: { $lte: monthEnd },
    endDate: { $gte: monthStart },
  }).select("userId startDate endDate leaveType");
  const leavesByUser = {};
  for (const leave of approvedLeaves) {
    const uid = String(leave.userId);
    (leavesByUser[uid] ||= []).push(leave);
  }
  // PWL ("leave without pay") deducts like an absence; CL/SL/EL stay paid.
  const leaveTypeOn = (uid, dateStr) =>
    (leavesByUser[uid] || []).find((l) => dateStr >= l.startDate && dateStr <= l.endDate)?.leaveType || null;

  const byUserId = {};
  for (const u of users) {
    const uid = String(u._id);
    const gross = u.monthlySalary;
    const perDayRate = gross != null ? gross / workingDates.length : null;

    let presentDays = 0, halfDays = 0, absentDays = 0, paidLeaveDays = 0, unpaidLeaveDays = 0;
    for (const dateStr of elapsedWorkingDates) {
      const status = attendanceByUser[uid]?.[dateStr];
      if (status === "present") presentDays++;
      else if (status === "half-day") halfDays++;
      else if (status === "absent") absentDays++;
      else {
        const leaveType = leaveTypeOn(uid, dateStr);
        if (leaveType === "PWL") unpaidLeaveDays++;
        else if (leaveType) paidLeaveDays++;
        else absentDays++;
      }
    }

    const deduction = perDayRate != null ? perDayRate * (absentDays + unpaidLeaveDays + halfDays * 0.5) : null;
    const netSalary = gross != null ? gross - deduction : null;

    byUserId[uid] = {
      userId: u._id,
      monthlySalary: gross,
      workingDaysInMonth: workingDates.length,
      presentDays,
      halfDays,
      absentDays,
      paidLeaveDays,
      unpaidLeaveDays,
      perDayRate: perDayRate != null ? round2(perDayRate) : null,
      deduction: deduction != null ? round2(deduction) : null,
      netSalary: netSalary != null ? round2(netSalary) : null,
    };
  }

  return { monthStr, byUserId };
};

// The fields a SalaryPayment snapshot always carries, regardless of how it was paid.
const snapshotFields = (summary, monthStr) => ({
  userId: summary.userId,
  month: monthStr,
  monthlySalary: summary.monthlySalary,
  workingDaysInMonth: summary.workingDaysInMonth,
  presentDays: summary.presentDays,
  halfDays: summary.halfDays,
  absentDays: summary.absentDays,
  paidLeaveDays: summary.paidLeaveDays,
  unpaidLeaveDays: summary.unpaidLeaveDays,
  perDayRate: summary.perDayRate,
  deduction: summary.deduction,
  netSalary: summary.netSalary,
});

// GET /api/payroll/summary — manager-only.
export const getPayrollSummary = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    const users = await User.find().select("name phone department role monthlySalary");
    const { monthStr, byUserId } = await computeMonthPayroll(users);

    const payments = await SalaryPayment.find({
      month: monthStr,
      userId: { $in: users.map((u) => u._id) },
    }).select("userId paidAt payoutMode payoutStatus failureReason");
    const paymentByUser = {};
    for (const pay of payments) paymentByUser[String(pay.userId)] = pay;

    const results = users.map((u) => {
      const payment = paymentByUser[String(u._id)];
      return {
        ...byUserId[String(u._id)],
        paid: !!payment && ["recorded", "processed"].includes(payment.payoutStatus),
        paidAt: payment?.paidAt || null,
        payoutMode: payment?.payoutMode || null,
        payoutStatus: payment?.payoutStatus || null,
        failureReason: payment?.failureReason || null,
      };
    });

    return res.json({ month: monthStr, results });
  } catch (err) {
    return res.status(500).json({ message: "Could not compute payroll summary.", error: err.message });
  }
};

// POST /api/payroll/:userId/pay — manager-only. Snapshots this month's
// computed payroll for one employee and records it as paid manually
// (cash/cheque/other channel — no real transfer is made).
export const paySalary = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    const user = await User.findById(req.params.userId).select("name phone department role monthlySalary");
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.monthlySalary == null) {
      return res.status(400).json({ message: "Set this employee's salary before paying." });
    }

    const { monthStr, byUserId } = await computeMonthPayroll([user]);
    const summary = byUserId[String(user._id)];

    const payment = await SalaryPayment.findOneAndUpdate(
      { userId: user._id, month: monthStr },
      {
        ...snapshotFields(summary, monthStr),
        payoutMode: "manual",
        payoutStatus: "recorded",
        razorpayPayoutId: null,
        failureReason: null,
        paidBy: req.user.id,
        paidAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return res.json({ message: `Salary marked as paid for ${user.name || user.phone}.`, payment });
  } catch (err) {
    return res.status(500).json({ message: "Could not record payment.", error: err.message });
  }
};

// DELETE /api/payroll/:userId/pay — manager-only. Undoes this month's payment
// mark. Blocked once a real bank transfer has actually gone out or is in
// flight — undoing that would just hide it, not reverse the money.
export const unpaySalary = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    const existing = await SalaryPayment.findOne({ userId: req.params.userId, month: currentMonthStr() });
    if (!existing) {
      return res.status(404).json({ message: "No payment record found for this month." });
    }
    if (existing.payoutMode === "razorpayx" && !["failed", "reversed"].includes(existing.payoutStatus)) {
      return res.status(400).json({ message: "Can't undo a bank transfer that has already gone out or is in progress." });
    }

    await existing.deleteOne();
    return res.json({ message: "Payment mark removed." });
  } catch (err) {
    return res.status(500).json({ message: "Could not undo payment.", error: err.message });
  }
};

// POST /api/payroll/:userId/payout — manager-only. Initiates an actual bank
// transfer for this month's net salary via RazorpayX.
export const payViaBankTransfer = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.monthlySalary == null) {
      return res.status(400).json({ message: "Set this employee's salary before paying." });
    }
    if (!user.bankAccount?.accountNumber || !user.bankAccount?.ifsc) {
      return res.status(400).json({ message: "Add this employee's bank account details before paying via bank transfer." });
    }

    const { monthStr, byUserId } = await computeMonthPayroll([user]);
    const summary = byUserId[String(user._id)];
    if (summary.netSalary == null || summary.netSalary <= 0) {
      return res.status(400).json({ message: "Nothing to pay for this month." });
    }

    const existing = await SalaryPayment.findOne({ userId: user._id, month: monthStr });
    if (existing && ["queued", "processing", "processed"].includes(existing.payoutStatus)) {
      return res.status(409).json({ message: "A payment for this month is already paid or in progress." });
    }

    try {
      if (!user.bankAccount.razorpayContactId) {
        const contact = await createContact({
          name: user.name || user.phone,
          contact: user.phone,
          referenceId: String(user._id),
        });
        user.bankAccount.razorpayContactId = contact.id;
      }
      if (!user.bankAccount.razorpayFundAccountId) {
        const fundAccount = await createFundAccount({
          contactId: user.bankAccount.razorpayContactId,
          accountHolderName: user.bankAccount.accountHolderName || user.name,
          accountNumber: user.bankAccount.accountNumber,
          ifsc: user.bankAccount.ifsc,
        });
        user.bankAccount.razorpayFundAccountId = fundAccount.id;
      }
      await user.save();

      const payout = await createPayout({
        fundAccountId: user.bankAccount.razorpayFundAccountId,
        amount: summary.netSalary,
        referenceId: `${user._id}-${monthStr}`,
        narration: `Salary ${monthStr}`,
      });

      const payment = await SalaryPayment.findOneAndUpdate(
        { userId: user._id, month: monthStr },
        {
          ...snapshotFields(summary, monthStr),
          payoutMode: "razorpayx",
          payoutStatus: payout.status === "processed" ? "processed" : "processing",
          razorpayPayoutId: payout.id,
          failureReason: null,
          paidBy: req.user.id,
          paidAt: payout.status === "processed" ? new Date() : null,
        },
        { upsert: true, new: true }
      );

      return res.json({ message: "Bank transfer initiated.", payment });
    } catch (err) {
      const failureReason = err.response?.data?.error?.description || err.message;
      const payment = await SalaryPayment.findOneAndUpdate(
        { userId: user._id, month: monthStr },
        {
          ...snapshotFields(summary, monthStr),
          payoutMode: "razorpayx",
          payoutStatus: "failed",
          failureReason,
          paidBy: req.user.id,
          paidAt: null,
        },
        { upsert: true, new: true }
      );
      return res.status(502).json({ message: `Bank transfer failed: ${failureReason}`, payment });
    }
  } catch (err) {
    return res.status(500).json({ message: "Could not initiate bank transfer.", error: err.message });
  }
};

// POST /api/payroll/webhook — public, but signature-verified. RazorpayX calls
// this to report a payout's final status (bank transfers aren't synchronous).
export const payrollWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.RAZORPAYX_WEBHOOK_SECRET;
    const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));

    const expected = crypto.createHmac("sha256", secret || "").update(payload).digest("hex");
    if (!secret || !signature || signature !== expected) {
      return res.status(400).json({ message: "Invalid webhook signature." });
    }

    const statusMap = {
      "payout.processed": "processed",
      "payout.failed": "failed",
      "payout.reversed": "reversed",
    };
    const newStatus = statusMap[req.body.event];
    const payoutEntity = req.body.payload?.payout?.entity;
    if (!newStatus || !payoutEntity) {
      return res.json({ received: true });
    }

    const update = { payoutStatus: newStatus };
    if (newStatus === "processed") update.paidAt = new Date();
    if (newStatus === "failed" || newStatus === "reversed") {
      update.failureReason = payoutEntity.failure_reason || payoutEntity.status_details?.description || "Transfer did not complete.";
    }

    await SalaryPayment.findOneAndUpdate({ razorpayPayoutId: payoutEntity.id }, update);
    return res.json({ received: true });
  } catch (err) {
    console.error("payroll webhook error:", err.message);
    return res.status(500).json({ received: false });
  }
};
