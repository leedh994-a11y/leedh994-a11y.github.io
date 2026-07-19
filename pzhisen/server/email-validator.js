/**
 * Permissive email validation — accepts mainstream global providers
 * (Gmail, Outlook, Yahoo, QQ, 163, iCloud, ProtonMail, corporate, etc.)
 */

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const MAX_LENGTH = 254;

export const SUPPORTED_EMAIL_HINT =
  "支持 Gmail、Outlook、Hotmail、Yahoo、iCloud、QQ邮箱、163邮箱、126邮箱、新浪邮箱、ProtonMail 及全球主流邮箱";

export function normalizeEmail(email) {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > MAX_LENGTH) return null;
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!local || !domain.includes(".")) return null;
  return `${local}@${domain}`;
}

export function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return EMAIL_RE.test(normalized);
}

export function validateEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { ok: false, error: "请填写有效的邮箱地址", errorEn: "Please enter a valid email address" };
  }
  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, error: "邮箱格式不正确", errorEn: "Invalid email format" };
  }
  return { ok: true, email: normalized };
}
