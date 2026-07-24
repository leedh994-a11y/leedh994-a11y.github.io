import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@pzhisen.online";

/** Merchant inbox for every subscription order worldwide (default: owner's Gmail). */
const DEFAULT_NOTIFY_EMAIL = "leedh994@gmail.com";

export function isMailConfigured() {
  return Boolean(resolveSmtpHost() && SMTP_USER && SMTP_PASS);
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
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    ...(SMTP_PORT === 587 ? { requireTLS: true } : {}),
  });
}

function resolveFromAddress() {
  const user = (SMTP_USER || "").toLowerCase();
  // Gmail / QQ / 163 require From to match the authenticated account
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

async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    console.log(`[mail] (SMTP not configured) to=${to} subject=${subject}\n${text}`);
    return { sent: false, devMode: true };
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
  return { sent: true };
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
    console.log(`[mail] OTP for ${email}: ${code} (SMTP not configured)`);
    return { sent: false, devMode: true };
  }

  return sendMail({ to: email, subject, text, html });
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
    console.log(`[mail] order notify event=${event} order=${order.id} to=${recipients.join(",")} sent=${result.sent}`);
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
  const text = `这是一封测试邮件。\n\n若您收到此信，说明网站订单通知已可送达：${recipients.join(", ")}\n\n时间：${new Date().toISOString()}\nhttps://www.pzhisen.online`;
  const html = orderEmailHtml("订单通知测试", [
    ["收件邮箱", recipients.join(", ")],
    ["SMTP", isMailConfigured() ? "已配置" : "未配置"],
    ["时间", new Date().toISOString()],
  ]);
  return sendMail({ to: recipients, subject, text, html });
}
