import webpush from "web-push";
import User from "../models/User.js";

let vapidConfigured = false;

// Configured lazily (on first send) rather than at import time, since ES module
// imports are hoisted and would otherwise run before server.js's dotenv.config().
const ensureVapidConfigured = () => {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
};

// Sends a push notification to every subscription saved for a user.
// Never throws — a failed/expired subscription is pruned and other errors are logged only.
export const sendPushToUser = async (userId, payload) => {
  try {
    ensureVapidConfigured();
    const user = await User.findById(userId);
    if (!user || !user.pushSubscriptions.length) return;

    const staleEndpoints = [];
    await Promise.all(
      user.pushSubscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(subscription, JSON.stringify(payload));
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleEndpoints.push(subscription.endpoint);
          } else {
            console.error("Push send failed:", err.message);
          }
        }
      })
    );

    if (staleEndpoints.length) {
      await User.findByIdAndUpdate(userId, {
        $pull: { pushSubscriptions: { endpoint: { $in: staleEndpoints } } },
      });
    }
  } catch (err) {
    console.error("sendPushToUser failed:", err.message);
  }
};
