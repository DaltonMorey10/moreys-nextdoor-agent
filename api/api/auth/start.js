const crypto = require("node:crypto");
const { required, signState, setCookie, redirect, requireSession } = require("../../lib/nd");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405; res.end("Method not allowed"); return;
  }

  try {
    const clientId = required("NEXTDOOR_CLIENT_ID");
    const redirectUri = required("NEXTDOOR_REDIRECT_URI");
    const state = crypto.randomBytes(32).toString("hex");
    const signed = signState(state, Date.now());
    setCookie(res, "nd_oauth_state", signed, 600);

    const scopes = (process.env.NEXTDOOR_SCOPES || "openid comment:write profile")
      .trim().split(/\s+/).join(" ");
    const url = new URL("https://www.nextdoor.com/v3/authorize/");
    url.searchParams.set("scope", scopes);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    redirect(res, url.toString());
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(`OAuth setup error: ${error.message}`);
  }
};
