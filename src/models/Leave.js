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
  leaveDate: {
    type: String,
    required: true,
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
}, { timestamps: true });

export default mongoose.model("Leave", leaveSchema);
