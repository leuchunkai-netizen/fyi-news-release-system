const { moderateTestimonialText } = require("../services/testimonialModeration");
/**
 * Placeholder for future server-side user operations.
 * Primary auth in this app is Supabase on the client.
 */

async function getServiceInfo(req, res) {
  res.json({
    auth: "client_supabase",
    message: "User sessions are handled by Supabase in the browser. Use this route for future admin/service checks.",
  });
}

async function moderateTestimonial(req, res) {
  try {
    const { message } = req.body || {};
    const result = await moderateTestimonialText(message);
    res.json(result);
  } catch (e) {
    res.status(500).json({
      allowed: false,
      reason: e.message || "Moderation failed.",
      provider: "server",
      confidence: 0,
    });
  }
}

module.exports = {
  getServiceInfo,
  moderateTestimonial,
};
