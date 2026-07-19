import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@pzhisen.online";

export function isMailConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function createTransport() {
  const secure = SMTP_PORT === 465;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    ...(SMTP_PORT === 587 ? { requireTLS: true } : {}),
  });
}

function resolveFromAddress() {
  // QQ/163 等国内邮箱要求发件人必须与登录账号一致
  if (SMTP_USER.includes("@qq.com") || SMTP_USER.includes("@foxmail.com")) {
    return SMTP_USER;
  }
  return SMTP_FROM;
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

  const transport = createTransport();
  await transport.sendMail({ from: resolveFromAddress(), to: email, subject, text, html });
  return { sent: true };
}
