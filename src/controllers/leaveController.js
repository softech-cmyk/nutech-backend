import Leave from "../models/Leave.js";
import { sendPushToUser } from "../utils/webPush.js";

const CL_ANNUAL_QUOTA = 12;

const daysInRange = (start, end) => Math.round((new Date(end) - new Date(start)) / 86400000) + 1;

// A half-day leave always covers a single day (0.5 units); anything else is
// counted in full days across its date range.
const leaveUnits = (l) => (l.isHalfDay ? 0.5 : daysInRange(l.startDate, l.endDate));

// POST /api/leaves/apply
export const applyLeave = async (req, res) => {
  try {
    const { leaveType, reason, startDate, endDate, isHalfDay } = req.body;
    if (!leaveType || !reason || !startDate || !endDate) {
      return res.status(400).json({ message: "All fields are required." });
    }
    if (startDate > endDate) {
      return res.status(400).json({ message: "Start date must be on or before end date." });
    }
    if (isHalfDay && startDate !== endDate) {
      return res.status(400).json({ message: "A half-day leave must be for a single date." });
    }
    const year = startDate.slice(0, 4);
    if (endDate.slice(0, 4) !== year) {
      return res.status(400).json({ message: "A leave request must stay within a single calendar year." });
    }

    if (leaveType === "CL") {
      const clLeaves = await Leave.find({
        userId: req.user.id,
        leaveType: "CL",
        status: { $ne: "rejected" },
        startDate: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
      });
      const usedDays = clLeaves.reduce((sum, l) => sum + leaveUnits(l), 0);
      const requestedDays = isHalfDay ? 0.5 : daysInRange(startDate, endDate);
      if (usedDays + requestedDays > CL_ANNUAL_QUOTA) {
        const remaining = Math.max(0, CL_ANNUAL_QUOTA - usedDays);
        return res.status(400).json({
          message: `You only have ${remaining} Casual Leave (CL) day(s) left for ${year}.`,
        });
      }
    }

    const leave = await Leave.create({
      userId: req.user.id,
      leaveType,
      reason,
      startDate,
      endDate,
      isHalfDay: !!isHalfDay,
    });
    return res.status(201).json({ message: "Leave applied successfully.", leave });
  } catch (err) {
    return res.status(500).json({ message: "Failed to apply leave.", error: err.message });
  }
};

// GET /api/leaves/all  — all leave requests (manager sees everyone's)
export const getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate("userId", "name phone department company role")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });
    return res.json({ leaves });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch leaves." });
  }
};

// GET /api/leaves/my  — logged-in user's own leaves
export const getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json({ leaves });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch leaves." });
  }
};

// DELETE /api/leaves/clear-all
export const clearAllLeaves = async (req, res) => {
  try {
    const result = await Leave.deleteMany({});
    return res.json({ message: `Cleared ${result.deletedCount} leave record(s).` });
  } catch (err) {
    return res.status(500).json({ message: "Clear failed.", error: err.message });
  }
};

// PATCH /api/leaves/:id/approve
export const approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { status: "approved", reviewedBy: req.user.id },
      { new: true }
    ).populate("userId", "name phone");
    if (!leave) return res.status(404).json({ message: "Leave not found." });

    const when = leave.isHalfDay
      ? `(half day) on ${leave.startDate}`
      : leave.startDate === leave.endDate
        ? `on ${leave.startDate}`
        : `from ${leave.startDate} to ${leave.endDate}`;
    sendPushToUser(leave.userId._id, {
      title: "Leave approved",
      body: `Your ${leave.leaveType} leave ${when} was approved.`,
      url: "/EmployeeDashboard",
    });

    return res.json({ message: "Leave approved.", leave });
  } catch (err) {
    return res.status(500).json({ message: "Failed to approve leave." });
  }
};

// PATCH /api/leaves/:id/reject
export const rejectLeave = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "A rejection reason is required." });
    }
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", reviewedBy: req.user.id, rejectionReason: reason.trim() },
      { new: true }
    ).populate("userId", "name phone");
    if (!leave) return res.status(404).json({ message: "Leave not found." });

    const when = leave.isHalfDay
      ? `(half day) on ${leave.startDate}`
      : leave.startDate === leave.endDate
        ? `on ${leave.startDate}`
        : `from ${leave.startDate} to ${leave.endDate}`;
    sendPushToUser(leave.userId._id, {
      title: "Leave rejected",
      body: `Your ${leave.leaveType} leave ${when} was rejected: ${leave.rejectionReason}`,
      url: "/EmployeeDashboard",
    });

    return res.json({ message: "Leave rejected.", leave });
  } catch (err) {
    return res.status(500).json({ message: "Failed to reject leave." });
  }
};
