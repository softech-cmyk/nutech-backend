import User from "../models/User.js";

// GET /api/notifications/vapid-public-key
export const getVapidPublicKey = (req, res) => {
  return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

// POST /api/notifications/subscribe
export const subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "A valid push subscription is required." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const alreadySubscribed = user.pushSubscriptions.some((sub) => sub.endpoint === endpoint);
    if (!alreadySubscribed) {
      user.pushSubscriptions.push(req.body);
      await user.save();
    }

    return res.json({ message: "Subscribed to push notifications." });
  } catch (err) {
    return res.status(500).json({ message: "Failed to save push subscription.", error: err.message });
  }
};
