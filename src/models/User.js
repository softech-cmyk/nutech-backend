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
  monthlySalary: {
    type: Number, // gross monthly salary in INR
    default: null,
  },
  bankAccount: {
    accountHolderName: { type: String, default: null },
    accountNumber: { type: String, default: null },
    ifsc: { type: String, default: null },
    // Cached RazorpayX identifiers so we only create a Contact/Fund Account
    // once per employee — cleared whenever the account number or IFSC changes.
    razorpayContactId: { type: String, default: null },
    razorpayFundAccountId: { type: String, default: null },
  },
  // Optional further deductions applied on top of the attendance-based net
  // salary to arrive at final in-hand pay. None are required — a manager
  // only fills in whichever apply to a given employee.
  salaryAdjustments: {
    esi:      { type: Number, default: null },
    pf:       { type: Number, default: null },
    bonus:    { type: Number, default: null },
    gratuity: { type: Number, default: null },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  pushSubscriptions: {
    type: [mongoose.Schema.Types.Mixed], // raw PushSubscription JSON objects from the browser
    default: [],
  },
}, { timestamps: true });

export default mongoose.model("User", userSchema);