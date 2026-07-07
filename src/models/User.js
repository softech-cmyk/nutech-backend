import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  countryCode: {
    type: String,
    default: "+91",
  },
  password: {
    type: String,
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  role: {
    type: String,
    enum: ["employee", "manager"],
    default: "employee",
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  department: {
    type: String,
    default: null,
  },
  company: {
    type: String,
    enum: ["Nutech International", "SPL Technologies"],
    default: "Nutech International",
  },
  mustChangePassword: {
    type: Boolean,
    default: false,
  },
  shiftStart: {
    type: String, // "HH:mm", 24-hour
    default: "10:00",
  },
  shiftEnd: {
    type: String, // "HH:mm", 24-hour
    default: "18:30",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
}, { timestamps: true });

export default mongoose.model("User", userSchema);