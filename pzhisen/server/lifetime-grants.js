/** Grandfathered lifetime subscribers — permanent access, no renewal required. */

const LIFETIME_EXPIRES = "2099-12-31T23:59:59.000Z";

/** Paid lifetime users before subscription pricing change (owner-requested restores). */
const BUILTIN_LIFETIME_EMAILS = new Set([
  "ddb1520@outlook.com",
]);

function parseEnvLifetimeEmails() {
  return (process.env.LIFETIME_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function getGrandfatheredLifetimeEmails() {
  const emails = new Set([...BUILTIN_LIFETIME_EMAILS, ...parseEnvLifetimeEmails()]);
  return [...emails];
}

export function isGrandfatheredLifetimeEmail(email) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BUILTIN_LIFETIME_EMAILS.has(normalized) || parseEnvLifetimeEmails().includes(normalized);
}

export function isLifetimeSubscription(sub) {
  if (!sub || sub.status !== "active") return false;
  if (sub.cycle === "lifetime" || sub.planId === "lifetime") return true;
  if (sub.expiresAt && new Date(sub.expiresAt).getFullYear() >= 2099) return true;
  return isGrandfatheredLifetimeEmail(sub.email);
}

export function lifetimeExpiresAt() {
  return LIFETIME_EXPIRES;
}
