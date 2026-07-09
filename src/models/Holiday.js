import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema({
  date: {
    type: String,   // "YYYY-MM-DD"
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
}, { timestamps: true });

export default mongoose.model("Holiday", holidaySchema);
