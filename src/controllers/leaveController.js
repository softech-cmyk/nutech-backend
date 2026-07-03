import Leave from "../models/Leave.js";

// POST /api/leaves/apply
export const applyLeave = async (req, res) => {
  try {
    const { leaveType, reason, leaveDate } = req.body;
    if (!leaveType || !reason || !leaveDate) {
      return res.status(400).json({ message: "All fields are required." });
    }
    const leave = await Leave.create({
      userId: req.user.id,
      leaveType,
      reason,
      leaveDate,
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
    return res.json({ message: "Leave approved.", leave });
  } catch (err) {
    return res.status(500).json({ message: "Failed to approve leave." });
  }
};

// PATCH /api/leaves/:id/reject
export const rejectLeave = async (req, res) => {
  try {
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", reviewedBy: req.user.id },
      { new: true }
    ).populate("userId", "name phone");
    if (!leave) return res.status(404).json({ message: "Leave not found." });
    return res.json({ message: "Leave rejected.", leave });
  } catch (err) {
    return res.status(500).json({ message: "Failed to reject leave." });
  }
};
