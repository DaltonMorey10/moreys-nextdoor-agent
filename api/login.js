const { required, signSession, setCookie } = require("../lib/nd");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
  try {
    let supplied = "";
    if (req.body && typeof req.body.password === "string") {
      supplied = req.body.password;
    } else {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      supplied = new URLSearchParams(raw).get("password") || "";
    }
    const expected = required("APP_PASSWORD");
    const crypto = require("node:crypto");
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.statusCode = 401;
      res.setHeader("Location", "/?login=failed");
      res.end();
      return;
    }
    setCookie(res, "moreys_admin_session", signSession(Date.now()), 7 * 24 * 60 * 60);
    res.statusCode = 303;
    res.setHeader("Location", "/");
    res.end();
  } catch (e) {
    res.statusCode = 500; res.end("Login is not configured.");
  }
};
