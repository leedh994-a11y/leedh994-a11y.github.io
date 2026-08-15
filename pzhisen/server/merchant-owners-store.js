import { loadJson, saveJson } from "./store.js";
import { getUserByEmail, updateUser } from "./auth-store.js";
import { getOrderNotifyEmails } from "./mail.js";

const FILE = "merchant-owners.json";

function load() {
  return loadJson(FILE, { emails: [] });
}

function save(data) {
  saveJson(FILE, data);
}

export function listPersistedMerchantEmails() {
  return load().emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isEnvMerchant(email) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return false;
  if (getOrderNotifyEmails().map((e) => e.toLowerCase()).includes(normalized)) return true;
  const extra = (process.env.MERCHANT_OWNER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(normalized);
}

export function isPersistedMerchant(email) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return false;
  if (listPersistedMerchantEmails().includes(normalized)) return true;
  const user = getUserByEmail(normalized);
  return Boolean(user?.merchantOwner);
}

/** Grant bank-revenue merchant access to an email (persisted across restarts). */
export function grantMerchantOwner(email) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized.includes("@")) return false;

  const data = load();
  if (!data.emails.includes(normalized)) {
    data.emails.push(normalized);
    save(data);
  }

  const user = getUserByEmail(normalized);
  if (user && !user.merchantOwner) {
    updateUser(user.id, { merchantOwner: true });
  }
  return true;
}

/** Ensure env-configured merchant emails always have persisted access. */
export function syncEnvMerchantOwners() {
  for (const email of getOrderNotifyEmails()) {
    grantMerchantOwner(email);
  }
  const extra = (process.env.MERCHANT_OWNER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const email of extra) {
    grantMerchantOwner(email);
  }
}
