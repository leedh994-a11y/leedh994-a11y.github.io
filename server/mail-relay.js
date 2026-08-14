import { sendTransactionalEmail, isSmtpConfigured } from "./mail.js";

function relaySecret() {
  return (process.env.MAIL_RELAY_SECRET || process.env.BILLING_ADMIN_SECRET || "").trim();
}

export function mailRelayStatusHandler(_req, res) {
  res.json({
    success: true,
    smtpReady: isSmtpConfigured(),
    relayEnabled: Boolean(relaySecret()),
  });
}

export async function mailRelaySendHandler(req, res) {
  const expected = relaySecret();
  const key = String(req.headers["x-mail-relay-key"] || "").trim();
  if (!expected || key !== expected) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const { to, subject, text, html } = req.body || {};
  if (!to || !subject) {
    return res.status(400).json({ success: false, error: "to and subject required" });
  }

  if (!isSmtpConfigured()) {
    return res.status(503).json({ success: false, error: "SMTP not configured on relay host" });
  }

  const result = await sendTransactionalEmail({ to, subject, text, html });
  if (!result.sent) {
    return res.status(502).json({ success: false, error: result.error || result.reason || "send failed" });
  }

  res.json({ success: true, sent: true, via: result.via || "smtp" });
}
