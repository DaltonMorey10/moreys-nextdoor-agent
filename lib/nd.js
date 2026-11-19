
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function supabase() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function encryptionKey() {
  const key = Buffer.from(required("TOKEN_ENCRYPTION_KEY_BASE64"), "base64");
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes");
  return key;
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final()
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map(b => b.toString("base64")).join(".");
}

function decryptJson(value) {
  const [iv, tag, data] = value.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final()
  ]).toString("utf8"));
}

function cookie(req, name) {
  const header = req.headers.cookie || "";
  const item = header.split(";").map(s => s.trim())
    .find(s => s.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

function setCookie(res, name, value, maxAge) {
  res.setHeader("Set-Cookie",
    `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
}

function clearCookie(res, name) {
  setCookie(res, name, "", 0);
}

function redirect(res, url) {
  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
}

function signState(state, issuedAt) {
  const payload = `${state}.${issuedAt}`;
  const signature = crypto.createHmac("sha256", required("OAUTH_STATE_SECRET"))
    .update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function verifyStateCookie(value, receivedState) {
  if (!value || !receivedState) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [state, issuedAtText, signature] = parts;
  const issuedAt = Number(issuedAtText);
  if (!Number.isFinite(issuedAt) ||
      Date.now() - issuedAt > 600000 ||
      issuedAt > Date.now() + 60000 ||
      state !== receivedState) return false;

  const expected = crypto.createHmac("sha256", required("OAUTH_STATE_SECRET"))
    .update(`${state}.${issuedAtText}`).digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected);
}

function signSession(issuedAt) {
  const payload = `moreys-admin.${issuedAt}`;
  const signature = crypto.createHmac("sha256", required("AUTH_SESSION_SECRET"))
    .update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function verifySessionCookie(value) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "moreys-admin") return false;
  const issuedAt = Number(parts[1]);
  if (!Number.isFinite(issuedAt) ||
      Date.now() - issuedAt > 604800000 ||
      issuedAt > Date.now() + 60000) return false;
  const expected = crypto.createHmac("sha256", required("AUTH_SESSION_SECRET"))
    .update(`${parts[0]}.${parts[1]}`).digest();
  const actual = Buffer.from(parts[2], "hex");
  return actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected);
}

function requireSession(req) {
  return verifySessionCookie(cookie(req, "moreys_admin_session"));
}

module.exports = {
  required, supabase, encryptJson, decryptJson,
  signState, verifyStateCookie, signSession,
  requireSession, cookie, setCookie, clearCookie, redirect
};
