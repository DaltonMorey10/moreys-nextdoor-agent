const {
  required, supabase, encryptJson, verifyStateCookie, cookie, clearCookie, requireSession
} = require("../../lib/nd");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405; res.end("Method not allowed"); return;
  }

  clearCookie(res, "nd_oauth_state");

  try {
    const { code, state, error, error_description } = req.query || {};
    if (error) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<h1>Nextdoor authorization was not completed</h1><p>${escapeHtml(String(error_description || error))}</p><p><a href="/">Return to Morey's agent</a></p>`);
      return;
    }

    const signedState = cookie(req, "nd_oauth_state");
    if (!verifyStateCookie(signedState, String(state || ""))) {
      res.statusCode = 400;
      res.end("OAuth state check failed. Return to the app and try connecting again.");
      return;
    }
    if (!code) {
      res.statusCode = 400; res.end("Nextdoor did not return an authorization code."); return;
    }

    const clientId = required("NEXTDOOR_CLIENT_ID");
    const clientSecret = required("NEXTDOOR_CLIENT_SECRET");
    const redirectUri = required("NEXTDOOR_REDIRECT_URI");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      client_id: clientId,
      redirect_uri: redirectUri
    });

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenResponse = await fetch("https://auth.nextdoor.com/v2/token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`
      },
      body
    });

    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Nextdoor token exchange failed:", tokenResponse.status, safeError(tokenData));
      res.statusCode = 502;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end("<h1>Nextdoor token exchange failed</h1><p>Check the Vercel function logs and confirm your credentials, scopes, and registered Redirect URI. No token was saved.</p><p><a href='/'>Return to the app</a></p>");
      return;
    }

    const expiresIn = Number(tokenData.expires_in || 0);
    const record = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_type: tokenData.token_type || "Bearer",
      scope: tokenData.scope || process.env.NEXTDOOR_SCOPES || "",
      expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      received_at: new Date().toISOString()
    };

    const { error: dbError } = await supabase()
      .from("nextdoor_connection")
      .upsert({
        id: "moreys-primary",
        encrypted_token_data: encryptJson(record),
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });

    if (dbError) {
      console.error("Token storage failed:", dbError.message);
      res.statusCode = 500;
      res.end("Authorization succeeded, but secure token storage failed. Check Supabase configuration. Do not reconnect repeatedly; inspect the server logs.");
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end("<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><title>Nextdoor connected</title></head><body style='font-family:system-ui;max-width:640px;margin:60px auto;padding:20px'><h1>Nextdoor authorization completed</h1><p>Your authorization token was stored encrypted in the Morey's backend.</p><p>This does not yet mean that neighborhood searching or comment publishing is active. Those features must be implemented and tested against the exact API access Nextdoor approves.</p><p><a href='/'>Return to Morey's agent</a></p></body></html>");
  } catch (error) {
    console.error("OAuth callback error:", error.message);
    res.statusCode = 500;
    res.end("The callback encountered a server error. Check Vercel function logs.");
  }
};

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function safeError(obj) {
  const copy = { ...obj };
  delete copy.access_token; delete copy.refresh_token;
  return copy;
}
