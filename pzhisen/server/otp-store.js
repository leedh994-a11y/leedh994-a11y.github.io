import crypto from "crypto";
import { loadJson, saveJson } from "./store.js";

const FILE = "otp-pending.json";
const OTP_TTL_MS = Number(process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000;
const MAX_ATTEMPTS = 5;

function data() {
  return loadJson(FILE, { pending: [] });
}

function save(d) {
  const now = Date.now();
  d.pending = d.pending.filter((p) => new Date(p.expiresAt).getTime() > now);
  saveJson(FILE, d);
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export function savePendingRegistration({ email, passwordHash, idea, code }) {
  const normalized = email.trim().toLowerCase();
  const d = data();
  d.pending = d.pending.filter((p) => p.email !== normalized);
  const entry = {
    email: normalized,
    passwordHash,
    idea: idea?.trim().slice(0, 2000) || "",
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  d.pending.push(entry);
  save(d);
  return entry;
}

export function verifyPendingOtp(email, code) {
  const normalized = email.trim().toLowerCase();
  const d = data();
  const idx = d.pending.findIndex((p) => p.email === normalized);
  if (idx < 0) return { ok: false, error: "验证码已过期，请重新注册" };

  const entry = d.pending[idx];
  if (new Date(entry.expiresAt) < new Date()) {
    d.pending.splice(idx, 1);
    save(d);
    return { ok: false, error: "验证码已过期，请重新注册" };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    d.pending.splice(idx, 1);
    save(d);
    return { ok: false, error: "尝试次数过多，请重新注册" };
  }

  if (hashCode(code) !== entry.codeHash) {
    entry.attempts += 1;
    d.pending[idx] = entry;
    save(d);
    return { ok: false, error: "验证码错误" };
  }

  const result = { ok: true, entry };
  d.pending.splice(idx, 1);
  save(d);
  return result;
}

export function getPending(email) {
  const normalized = email.trim().toLowerCase();
  return data().pending.find((p) => p.email === normalized) || null;
}
