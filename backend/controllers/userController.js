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

module.exports = {
  getServiceInfo,
};
