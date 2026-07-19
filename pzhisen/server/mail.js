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
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
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
  await transport.sendMail({ from: SMTP_FROM, to: email, subject, text, html });
  return { sent: true };
}
