import axios from "axios";

const BASE_URL = "https://api.razorpay.com/v1";

// Thin wrapper around RazorpayX's Payouts API: Contact -> Fund Account -> Payout.
// https://razorpay.com/docs/api/x/
const client = () =>
  axios.create({
    baseURL: BASE_URL,
    auth: {
      username: process.env.RAZORPAYX_KEY_ID,
      password: process.env.RAZORPAYX_KEY_SECRET,
    },
  });

// A Contact represents the payee (the employee). Created once per employee.
export const createContact = async ({ name, contact, referenceId }) => {
  const { data } = await client().post("/contacts", {
    name,
    contact,
    type: "employee",
    reference_id: referenceId,
  });
  return data; // { id: "cont_xxx", ... }
};

// A Fund Account attaches a bank account to a Contact. Payouts are sent to
// a fund account, not directly to raw account number + IFSC each time.
export const createFundAccount = async ({ contactId, accountHolderName, accountNumber, ifsc }) => {
  const { data } = await client().post("/fund_accounts", {
    contact_id: contactId,
    account_type: "bank_account",
    bank_account: {
      name: accountHolderName,
      ifsc,
      account_number: accountNumber,
    },
  });
  return data; // { id: "fa_xxx", ... }
};

// Initiates the actual transfer from the company's RazorpayX account to the
// employee's fund account. Amount is in rupees here; RazorpayX wants paise.
export const createPayout = async ({ fundAccountId, amount, referenceId, narration }) => {
  const { data } = await client().post("/payouts", {
    account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
    fund_account_id: fundAccountId,
    amount: Math.round(amount * 100),
    currency: "INR",
    mode: "IMPS",
    purpose: "salary",
    queue_if_low_balance: true,
    reference_id: referenceId,
    narration,
  });
  return data; // { id: "pout_xxx", status: "queued" | "processing" | "processed", ... }
};
