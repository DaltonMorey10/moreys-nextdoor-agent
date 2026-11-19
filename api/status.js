const { supabase, requireSession } = require("../lib/nd");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") { res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return; }
  try {
    const { data, error } = await supabase()
      .from("nextdoor_connection")
      .select("connected_at, updated_at")
      .eq("id", "moreys-primary")
      .maybeSingle();
    if (error) throw error;
    res.statusCode = 200;
    res.end(JSON.stringify({
      connected: Boolean(data),
      connected_at: data?.connected_at || null,
      note: "Connection status only. Tokens are never returned to the browser."
    }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Status unavailable. Check server configuration." }));
  }
};
