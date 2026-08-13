import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@yoursite.asia";

const GITHUB_NOTIFY_TOKEN = (process.env.GITHUB_NOTIFY_TOKEN || process.env.GH_NOTIFY_TOKEN || "").trim();
const GITHUB_NOTIFY_REPO =
  (process.env.GITHUB_NOTIFY_REPO || "leedh994-a11y/leedh994-a11y.github.io").trim();

/** Merchant inbox — global subscription order alerts. */
const DEFAULT_NOTIFY_EMAIL = "ddb1520@outlook.com";
const SITE_URL = process.env.PUBLIC_URL || "https://yoursite.asia";

export function isSmtpConfigured() {
  return Boolean(resolveSmtpHost() && SMTP_USER && SMTP_PASS);
}

export function isGithubNotifyConfigured() {
  return Boolean(GITHUB_NOTIFY_TOKEN && GITHUB_NOTIFY_REPO.includes("/"));
}

export function isMailConfigured() {
  return isSmtpConfigured() || isGithubNotifyConfigured();
}

function resolveSmtpHost() {
  if (SMTP_HOST) return SMTP_HOST;
  const user = (SMTP_USER || "").toLowerCase();
  if (user.endsWith("@gmail.com") || user.endsWith("@googlemail.com")) return "smtp.gmail.com";
  if (user.endsWith("@outlook.com") || user.endsWith("@hotmail.com") || user.endsWith("@live.com")) {
    return "smtp-mail.outlook.com";
  }
  if (user.endsWith("@qq.com") || user.endsWith("@foxmail.com")) return "smtp.qq.com";
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
    user.endsWith("@outlook.com") ||
    user.endsWith("@hotmail.com") ||
    user.endsWith("@live.com") ||
    user.includes("@qq.com")
  ) {
    return SMTP_USER;
  }
  return SMTP_FROM;
}

export function getOrderNotifyEmails() {
  const raw = process.env.ORDER_NOTIFY_EMAIL || process.env.OWNER_EMAIL || DEFAULT_NOTIFY_EMAIL;
  return [
    ...new Set(
      raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@"))
    ),
  ];
}

export function isOrderNotifyConfigured() {
  return isMailConfigured() && getOrderNotifyEmails().length > 0;
}

async function sendViaGithubActions({ to, subject, text, html }) {
  if (!isGithubNotifyConfigured()) {
    return { sent: false, reason: "github_notify_not_configured" };
  }
  const recipients = Array.isArray(to) ? to.join(", ") : to;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_NOTIFY_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_NOTIFY_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "sitp-order-notify",
    },
    body: JSON.stringify({
      event_type: "order-notify",
      client_payload: {
        subject: String(subject || "").slice(0, 200),
        body: String(text || "").slice(0, 50000),
        html: String(html || "").slice(0, 100000),
        to: recipients,
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
  if (!isSmtpConfigured()) return { sent: false, reason: "smtp_not_configured" };
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

async function sendMail({ to, subject, text, html }) {
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
    if (isGithubNotifyConfigured()) {
      console.error("[mail] smtp failed, falling back to github actions:", err.message);
      return sendViaGithubActions({ to, subject, text, html });
    }
    throw err;
  }
}

function moneyLabel(order) {
  const cur = (order.currency || "USD").toUpperCase();
  if (cur === "CNY" || cur === "RMB") return `¥${order.amount}`;
  if (cur === "USD") return `$${order.amount}`;
  return `${order.amount} ${cur}`;
}

function cycleLabel(cycle) {
  if (cycle === "yearly") return "年付 / Yearly";
  if (cycle === "monthly") return "月付 / Monthly";
  if (cycle === "onetime") return "一次性 / One-time";
  return cycle || "—";
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
      <p style="color:#444;margin:0 0 16px">来自 <a href="${SITE_URL}">yoursite.asia</a> 的全球用户订阅订单通知。</p>
      <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:8px">${rows}</table>
      <p style="color:#888;font-size:12px;margin-top:24px">— Sitp GPT 自动通知</p>
    </div>
  `;
}

export async function notifyOrderEvent(event, order, extra = {}) {
  const recipients = getOrderNotifyEmails();
  if (!recipients.length) return { sent: false, reason: "no_recipients" };

  const eventTitles = {
    created: "🛒 新订阅订单（待支付）",
    paid: "✅ 订阅订单已支付并开通",
    trial: "🎁 新用户开始免费试用",
    completed: "✅ 订单已完成",
  };
  const title = eventTitles[event] || `订单通知：${event}`;
  const subject = `[Sitp GPT] ${title} · ${order.email} · ${moneyLabel(order)}`;

  const lines = [
    ["事件", event],
    ["订单号", order.id || order.externalId || "—"],
    ["用户邮箱", order.email || "—"],
    ["套餐", order.planId || "—"],
    ["周期", cycleLabel(order.cycle)],
    ["金额", moneyLabel(order)],
    ["支付方式", order.provider || "paypal"],
    ["状态", order.status || event],
  ];
  if (order.externalId) lines.push(["PayPal 单号", order.externalId]);
  if (order.captureId) lines.push(["Capture ID", order.captureId]);
  if (extra.expiresAt) lines.push(["订阅到期", extra.expiresAt]);
  if (extra.message) lines.push(["说明", extra.message]);
  lines.push(["时间", new Date().toISOString()]);

  const text = [`${title}`, "", ...lines.map(([k, v]) => `${k}: ${v}`), "", SITE_URL].join("\n");
  const html = orderEmailHtml(title, lines);

  try {
    const result = await sendMail({ to: recipients, subject, text, html });
    console.log(
      `[mail] order notify event=${event} order=${order.id || order.externalId} to=${recipients.join(",")} sent=${result.sent}`
    );
    return { ...result, recipients };
  } catch (err) {
    console.error(`[mail] order notify failed event=${event}:`, err.message);
    return { sent: false, error: err.message, recipients };
  }
}

export async function sendNotifyTestEmail() {
  const recipients = getOrderNotifyEmails();
  const subject = "[Sitp GPT] 订单通知测试 — 邮件已接通";
  const text = `这是一封测试邮件。\n\n若您收到此信，说明 yoursite.asia 订单通知已可送达：${recipients.join(", ")}\n\n时间：${new Date().toISOString()}\n${SITE_URL}`;
  const html = orderEmailHtml("订单通知测试", [
    ["收件邮箱", recipients.join(", ")],
    ["SMTP", isSmtpConfigured() ? "已配置" : "未配置"],
    ["GitHub Actions 桥接", isGithubNotifyConfigured() ? "已配置" : "未配置"],
    ["时间", new Date().toISOString()],
  ]);
  return sendMail({ to: recipients, subject, text, html });
}
