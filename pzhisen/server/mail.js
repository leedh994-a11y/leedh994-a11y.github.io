import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@pzhisen.online";

/** GitHub Actions email bridge (HTTPS) — bypasses Render free-tier SMTP block. */
const GITHUB_NOTIFY_TOKEN = (process.env.GITHUB_NOTIFY_TOKEN || process.env.GH_NOTIFY_TOKEN || "").trim();
const GITHUB_NOTIFY_REPO =
  (process.env.GITHUB_NOTIFY_REPO || "leedh994-a11y/leedh994-a11y.github.io").trim();

/** HTTPS mail relay (yoursite.asia SMTP) — synchronous OTP delivery on Render. */
const MAIL_RELAY_URL = (process.env.MAIL_RELAY_URL || "https://yoursite.asia/api/mail/send").trim();
const MAIL_RELAY_SECRET = (
  process.env.MAIL_RELAY_SECRET || process.env.MAIL_RELAY_KEY || "sitp-notify-admin-2026"
).trim();

const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const RESEND_FROM = (process.env.RESEND_FROM || "Pzhisen <onboarding@resend.dev>").trim();
const BREVO_API_KEY = (process.env.BREVO_API_KEY || "").trim();
const BREVO_FROM_EMAIL = (process.env.BREVO_FROM_EMAIL || process.env.SMTP_FROM || "noreply@pzhisen.online").trim();
const BREVO_FROM_NAME = (process.env.BREVO_FROM_NAME || "Pzhisen").trim();

/** Merchant inbox for every subscription order worldwide (default: owner's Gmail). */
const DEFAULT_NOTIFY_EMAIL = "leedh994@gmail.com";

export function isSmtpConfigured() {
  return Boolean(resolveSmtpHost() && SMTP_USER && SMTP_PASS);
}

export function isGithubNotifyConfigured() {
  return Boolean(GITHUB_NOTIFY_TOKEN && GITHUB_NOTIFY_REPO.includes("/"));
}

export function isMailRelayConfigured() {
  return Boolean(MAIL_RELAY_URL && MAIL_RELAY_SECRET);
}

export function isResendConfigured() {
  return Boolean(RESEND_API_KEY);
}

export function isBrevoConfigured() {
  return Boolean(BREVO_API_KEY);
}

export function isMailConfigured() {
  return (
    isSmtpConfigured() ||
    isMailRelayConfigured() ||
    isResendConfigured() ||
    isBrevoConfigured() ||
    isGithubNotifyConfigured()
  );
}

function resolveSmtpHost() {
  if (SMTP_HOST) return SMTP_HOST;
  const user = (SMTP_USER || "").toLowerCase();
  if (user.endsWith("@gmail.com") || user.endsWith("@googlemail.com")) return "smtp.gmail.com";
  if (user.endsWith("@qq.com") || user.endsWith("@foxmail.com")) return "smtp.qq.com";
  if (user.endsWith("@163.com")) return "smtp.163.com";
  if (user.endsWith("@126.com")) return "smtp.126.com";
  return "";
}

function createTransport() {
  const host = resolveSmtpHost();
  const secure = SMTP_PORT === 465;
  return nodemailer.createTransport({
    host,
    port: SMTP_PORT,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    ...(SMTP_PORT === 587 ? { requireTLS: true } : {}),
  });
}

function resolveFromAddress() {
  const user = (SMTP_USER || "").toLowerCase();
  if (
    user.endsWith("@gmail.com") ||
    user.endsWith("@googlemail.com") ||
    user.includes("@qq.com") ||
    user.includes("@foxmail.com") ||
    user.endsWith("@163.com") ||
    user.endsWith("@126.com")
  ) {
    return SMTP_USER;
  }
  return SMTP_FROM;
}

/** Comma-separated ORDER_NOTIFY_EMAIL / OWNER_EMAIL; defaults to LeeDh994 Gmail. */
export function getOrderNotifyEmails() {
  const raw =
    process.env.ORDER_NOTIFY_EMAIL ||
    process.env.OWNER_EMAIL ||
    DEFAULT_NOTIFY_EMAIL;
  return [...new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"))
  )];
}

export function isOrderNotifyConfigured() {
  return isMailConfigured() && getOrderNotifyEmails().length > 0;
}

async function sendViaMailRelay({ to, subject, text, html }) {
  if (!isMailRelayConfigured()) {
    return { sent: false, reason: "mail_relay_not_configured" };
  }
  const res = await fetch(MAIL_RELAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mail-relay-key": MAIL_RELAY_SECRET,
    },
    body: JSON.stringify({ to: Array.isArray(to) ? to[0] : to, subject, text, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Mail relay HTTP ${res.status}`);
  }
  return { sent: true, via: "mail_relay" };
}

async function sendViaResend({ to, subject, text, html }) {
  if (!isResendConfigured()) return { sent: false, reason: "resend_not_configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [Array.isArray(to) ? to[0] : to],
      subject,
      text,
      html: html || undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Resend HTTP ${res.status}`);
  return { sent: true, via: "resend" };
}

async function sendViaBrevo({ to, subject, text, html }) {
  if (!isBrevoConfigured()) return { sent: false, reason: "brevo_not_configured" };
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: BREVO_FROM_NAME, email: BREVO_FROM_EMAIL },
      to: [{ email: Array.isArray(to) ? to[0] : to }],
      subject,
      textContent: text,
      htmlContent: html || undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Brevo HTTP ${res.status}`);
  return { sent: true, via: "brevo" };
}

function otpSmtpCreds() {
  const user = (process.env.OTP_SMTP_USER || process.env.SMTP_USER || "768204575@qq.com").trim();
  const pass = (process.env.OTP_SMTP_PASS || process.env.SMTP_PASS || "").trim();
  const host = (process.env.OTP_SMTP_HOST || process.env.SMTP_HOST || resolveSmtpHostForUser(user) || "").trim();
  return { user, pass, host };
}

function resolveSmtpHostForUser(user) {
  const u = (user || "").toLowerCase();
  if (u.endsWith("@gmail.com") || u.endsWith("@googlemail.com")) return "smtp.gmail.com";
  if (u.endsWith("@qq.com") || u.endsWith("@foxmail.com")) return "smtp.qq.com";
  if (u.endsWith("@163.com")) return "smtp.163.com";
  if (u.endsWith("@126.com")) return "smtp.126.com";
  return "";
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const githubApiHeaders = {
  Authorization: `Bearer ${GITHUB_NOTIFY_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function getRecentWorkflowRunIds() {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_NOTIFY_REPO}/actions/workflows/order-notify-email.yml/runs?per_page=8`,
    { headers: { ...githubApiHeaders, "User-Agent": "pzhisen-otp-mail" } }
  );
  const data = await res.json().catch(() => ({}));
  return new Set((data.workflow_runs || []).map((r) => r.id));
}

/** Poll GitHub Actions until the workflow run triggered after dispatch completes. */
async function waitGithubOtpWorkflow(beforeRunIds, maxWaitMs = 55000) {
  if (!isGithubNotifyConfigured()) return { ok: false, error: "github_not_configured" };
  const started = Date.now();
  let targetRunId = null;

  while (Date.now() - started < maxWaitMs) {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_NOTIFY_REPO}/actions/workflows/order-notify-email.yml/runs?per_page=8`,
      { headers: { ...githubApiHeaders, "User-Agent": "pzhisen-otp-mail" } }
    );
    const data = await res.json().catch(() => ({}));
    const newRun = (data.workflow_runs || []).find((r) => !beforeRunIds.has(r.id));
    if (newRun) {
      targetRunId = newRun.id;
      break;
    }
    await sleep(1500);
  }
  if (!targetRunId) {
    return { ok: false, error: "GitHub workflow did not start" };
  }

  let lastStatus = "queued";
  while (Date.now() - started < maxWaitMs) {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_NOTIFY_REPO}/actions/runs/${targetRunId}`,
      { headers: { ...githubApiHeaders, "User-Agent": "pzhisen-otp-mail" } }
    );
    const run = await res.json().catch(() => ({}));
    lastStatus = `${run.status}/${run.conclusion || "pending"}`;
    if (run.status === "completed") {
      if (run.conclusion === "success") return { ok: true, runId: targetRunId };
      return { ok: false, error: `GitHub workflow failed: ${run.conclusion}`, runId: targetRunId };
    }
    await sleep(2000);
  }
  return { ok: false, error: `GitHub workflow timeout (${lastStatus})`, runId: targetRunId };
}

async function sendOtpViaGithubSync({ to, subject, text, html }) {
  const creds = otpSmtpCreds();
  if (!isGithubNotifyConfigured()) {
    return { sent: false, reason: "github_notify_not_configured" };
  }
  const beforeRunIds = await getRecentWorkflowRunIds();
  const recipients = Array.isArray(to) ? to.join(", ") : to;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_NOTIFY_REPO}/dispatches`, {
    method: "POST",
    headers: {
      ...githubApiHeaders,
      "Content-Type": "application/json",
      "User-Agent": "pzhisen-otp-mail",
    },
    body: JSON.stringify({
      event_type: "order-notify",
      client_payload: {
        subject: String(subject || "").slice(0, 200),
        body: String(text || "").slice(0, 50000),
        html: String(html || "").slice(0, 100000),
        to: recipients,
        ...(creds.user && creds.pass
          ? {
              smtp_user: creds.user,
              smtp_pass: creds.pass,
              smtp_from: creds.user,
              ...(creds.host ? { smtp_host: creds.host } : {}),
            }
          : {}),
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub dispatch HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  const waited = await waitGithubOtpWorkflow(beforeRunIds);
  if (!waited.ok) throw new Error(waited.error || "GitHub OTP mail failed");
  return { sent: true, via: "github_actions_sync", runId: waited.runId };
}

async function sendViaGithubActions({ to, subject, text, html }) {
  if (!isGithubNotifyConfigured()) {
    return { sent: false, reason: "github_notify_not_configured" };
  }
  const recipients = Array.isArray(to) ? to.join(", ") : to;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_NOTIFY_REPO}/dispatches`, {
    method: "POST",
    headers: {
      ...githubApiHeaders,
      "Content-Type": "application/json",
      "User-Agent": "pzhisen-order-notify",
    },
    body: JSON.stringify({
      event_type: "order-notify",
      client_payload: {
        subject: String(subject || "").slice(0, 200),
        body: String(text || "").slice(0, 50000),
        html: String(html || "").slice(0, 100000),
        to: recipients,
        ...(SMTP_USER && SMTP_PASS
          ? {
              smtp_user: SMTP_USER,
              smtp_pass: SMTP_PASS,
              smtp_from: resolveFromAddress(),
              ...((SMTP_HOST || resolveSmtpHost()) ? { smtp_host: SMTP_HOST || resolveSmtpHost() } : {}),
            }
          : {}),
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub dispatch HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  return { sent: true, via: "github_actions" };
}

async function sendViaSmtp({ to, subject, text, html }) {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }
  const transport = createTransport();
  const recipients = Array.isArray(to) ? to.join(", ") : to;
  await transport.sendMail({
    from: resolveFromAddress(),
    to: recipients,
    subject,
    text,
    html,
  });
  return { sent: true, via: "smtp" };
}

async function sendMail({ to, subject, text, html }, { preferSync = false } = {}) {
  const syncProviders = [
    () => sendViaMailRelay({ to, subject, text, html }),
    () => sendViaResend({ to, subject, text, html }),
    () => sendViaBrevo({ to, subject, text, html }),
    () => sendViaSmtp({ to, subject, text, html }),
  ];

  if (preferSync) {
    for (const attempt of syncProviders) {
      try {
        const result = await attempt();
        if (result.sent) return result;
      } catch (err) {
        console.error("[mail] sync provider failed:", err.message);
      }
    }
  }

  // Prefer GitHub Actions bridge on Render free (SMTP ports blocked).
  if (isGithubNotifyConfigured()) {
    try {
      return await sendViaGithubActions({ to, subject, text, html });
    } catch (err) {
      console.error("[mail] github actions notify failed:", err.message);
      if (!isSmtpConfigured()) throw err;
    }
  }

  if (!isSmtpConfigured()) {
    console.log(`[mail] (not configured) to=${to} subject=${subject}\n${text}`);
    return { sent: false, devMode: true };
  }

  try {
    return await sendViaSmtp({ to, subject, text, html });
  } catch (err) {
    // SMTP often times out on Render free — fall back to GitHub if available
    if (isGithubNotifyConfigured()) {
      console.error("[mail] smtp failed, falling back to github actions:", err.message);
      return sendViaGithubActions({ to, subject, text, html });
    }
    throw err;
  }
}

export async function sendOtpEmail(email, code) {
  const subject = "Pzhisen 注册验证码";
  const text = `您的 Pzhisen 注册验证码是：${code}\n\n验证码 10 分钟内有效，请勿泄露给他人。\n\n— Pzhisen`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>Pzhisen 注册验证码</h2>
      <p>您的验证码是：</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111">${code}</p>
      <p style="color:#666;font-size:14px">验证码 10 分钟内有效，请勿泄露给他人。</p>
    </div>
  `;

  if (!isMailConfigured()) {
    console.log(`[mail] OTP for ${email}: ${code} (mail not configured)`);
    return { sent: false, devMode: true };
  }

  try {
    const syncProviders = [
      () => sendViaMailRelay({ to: email, subject, text, html }),
      () => sendOtpViaGithubSync({ to: email, subject, text, html }),
      () => sendViaResend({ to: email, subject, text, html }),
      () => sendViaBrevo({ to: email, subject, text, html }),
      () => sendViaSmtp({ to: email, subject, text, html }),
    ];
    for (const attempt of syncProviders) {
      try {
        const result = await attempt();
        if (result.sent) return result;
      } catch (err) {
        console.error(`[mail] OTP provider failed:`, err.message);
      }
    }
    return { sent: false, error: "所有邮件通道均失败，请稍后重试" };
  } catch (err) {
    console.error(`[mail] OTP send failed for ${email}:`, err.message);
    return { sent: false, error: err.message };
  }
}

function moneyLabel(order) {
  const cur = (order.currency || "").toUpperCase();
  if (cur === "CNY" || cur === "RMB") return `¥${order.amount}`;
  if (cur === "USD") return `$${order.amount}`;
  return `${order.amount} ${cur || ""}`.trim();
}

function cycleLabel(cycle) {
  if (cycle === "annual") return "年付 / Annual";
  if (cycle === "monthly") return "月付 / Monthly";
  return cycle || "—";
}

function providerLabel(provider) {
  if (provider === "bankcard" || provider === "bank") return "银行卡转账 (中国银行/Visa)";
  if (provider === "paypal") return "PayPal";
  return provider || "—";
}

function orderEmailHtml(title, lines) {
  const rows = lines
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;color:#666;border-bottom:1px solid #eee">${k}</td><td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #eee">${v}</td></tr>`
    )
    .join("");
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
      <h2 style="margin:0 0 16px">${title}</h2>
      <p style="color:#444;margin:0 0 16px">来自网站 <a href="https://www.pzhisen.online">www.pzhisen.online</a> 的订阅订单通知。</p>
      <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:8px">${rows}</table>
      <p style="color:#888;font-size:12px;margin-top:24px">— Pzhisen 自动通知 · 请勿直接回复</p>
    </div>
  `;
}

/**
 * Notify merchant Gmail of a subscription order event.
 * Never throws — checkout must not fail because of email.
 */
export async function notifyOrderEvent(event, order, extra = {}) {
  const recipients = getOrderNotifyEmails();
  if (!recipients.length) return { sent: false, reason: "no_recipients" };

  const eventTitles = {
    created: "🛒 新订阅订单（待支付）",
    awaiting_transfer: "🏦 银行卡转账订单 — 请核对到账",
    paid: "✅ 订阅订单已支付并开通",
    completed: "✅ 订阅订单已完成",
  };
  const title = eventTitles[event] || `订单通知：${event}`;
  const subject = `[Pzhisen] ${title} · ${order.email} · ${moneyLabel(order)}`;

  const lines = [
    ["事件", event],
    ["订单号", order.id || "—"],
    ["用户邮箱", order.email || "—"],
    ["套餐", order.planId || "pro"],
    ["周期", cycleLabel(order.cycle)],
    ["金额", moneyLabel(order)],
    ["支付方式", providerLabel(order.provider)],
    ["状态", order.status || event],
  ];
  if (order.transferCode) lines.push(["转账备注码", order.transferCode]);
  if (order.externalId) lines.push(["外部单号", order.externalId]);
  if (order.captureId) lines.push(["Capture ID", order.captureId]);
  if (extra.expiresAt) lines.push(["订阅到期", extra.expiresAt]);
  if (extra.message) lines.push(["说明", extra.message]);
  lines.push(["时间", new Date().toISOString()]);

  const text = [`${title}`, "", ...lines.map(([k, v]) => `${k}: ${v}`), "", "https://www.pzhisen.online"].join("\n");
  const html = orderEmailHtml(title, lines);

  try {
    const result = await sendMail({ to: recipients, subject, text, html });
    console.log(`[mail] order notify event=${event} order=${order.id} to=${recipients.join(",")} sent=${result.sent} via=${result.via || "?"}`);
    return { ...result, recipients };
  } catch (err) {
    console.error(`[mail] order notify failed event=${event} order=${order?.id}:`, err.message);
    return { sent: false, error: err.message, recipients };
  }
}

/** Admin can verify Gmail delivery without creating an order. */
export async function sendNotifyTestEmail() {
  const recipients = getOrderNotifyEmails();
  const subject = "[Pzhisen] 订单通知测试 — Gmail 已接通";
  const text = `这是一封测试邮件。\n\n若您收到此信，说明网站订单通知已可送达：${recipients.join(", ")}\n\n通道：${isGithubNotifyConfigured() ? "GitHub Actions → Gmail SMTP" : "SMTP"}\n时间：${new Date().toISOString()}\nhttps://www.pzhisen.online`;
  const html = orderEmailHtml("订单通知测试", [
    ["收件邮箱", recipients.join(", ")],
    ["SMTP", isSmtpConfigured() ? "已配置" : "未配置"],
    ["GitHub Actions 桥接", isGithubNotifyConfigured() ? "已配置" : "未配置"],
    ["时间", new Date().toISOString()],
  ]);
  return sendMail({ to: recipients, subject, text, html });
}
