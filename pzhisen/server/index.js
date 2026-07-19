import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { isAiEnabled, getModels } from "./openrouter.js";
import { AGENTS, runAgent, runDailyStandup } from "./agents.js";
import {
  upsertCompany,
  getCompany,
  appendLog,
  getLogs,
  getGlobalLogs,
  findCompanyByEmail,
} from "./store.js";
import {
  getBillingConfig,
  getPlansHandler,
  getSubscriptionStatus,
  checkoutHandler,
  capturePayPalHandler,
  orderStatusHandler,
  confirmBankTransferHandler,
  listPendingBankOrdersHandler,
  approveBankOrderHandler,
} from "./billing.js";
import { isSubscriptionActive, getSubscriptionByEmail } from "./billing-store.js";
import {
  registerHandler,
  verifyOtpHandler,
  resendOtpHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  requireAuth,
  requireCompanyAccess,
} from "./auth.js";
import { getUserById, updateUser } from "./auth-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "Pzhisen");
  next();
});

// ─── API ───
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "pzhisen", ai: isAiEnabled() });
});

app.get("/api/config", (_req, res) => {
  res.json({
    success: true,
    publicUrl: PUBLIC_URL,
    aiEnabled: isAiEnabled(),
    models: getModels(),
    agents: Object.values(AGENTS).map((a) => ({ id: a.id, name: a.name, icon: a.icon })),
    billing: getBillingConfig(),
  });
});

// ─── Auth ───
app.post("/api/auth/register", registerHandler);
app.post("/api/auth/verify-otp", verifyOtpHandler);
app.post("/api/auth/resend-otp", resendOtpHandler);
app.post("/api/auth/login", loginHandler);
app.post("/api/auth/logout", logoutHandler);
app.get("/api/auth/me", requireAuth, meHandler);

// ─── Billing / subscriptions ───
app.get("/api/billing/config", (_req, res) => res.json(getBillingConfig()));
app.get("/api/billing/plans", getPlansHandler);
app.get("/api/billing/subscription", requireAuth, (req, res) => {
  req.query.email = req.user.email;
  getSubscriptionStatus(req, res);
});
app.post("/api/billing/checkout", requireAuth, (req, res) => {
  req.body = { ...req.body, email: req.user.email };
  checkoutHandler(req, res);
});
app.post("/api/billing/paypal/capture", capturePayPalHandler);
app.get("/api/billing/order/:orderId", orderStatusHandler);
app.post("/api/billing/bank/confirm", confirmBankTransferHandler);
app.get("/api/billing/admin/pending", listPendingBankOrdersHandler);
app.post("/api/billing/admin/approve", approveBankOrderHandler);

app.get("/api/logs/global", (_req, res) => {
  res.json({ success: true, logs: getGlobalLogs(40) });
});

/** @deprecated Use /api/auth/register + verify-otp */
app.post("/api/signup", (_req, res) => {
  res.status(410).json({
    success: false,
    error: "请前往 /login.html 注册账号（邮箱 + 密码 + 验证码）",
  });
});

app.get("/api/companies/:id", requireAuth, requireCompanyAccess, (req, res) => {
  const company = req.company;
  const active = isSubscriptionActive(company.email);
  if (active && company.plan !== "lifetime") {
    company.plan = "lifetime";
    upsertCompany(company);
  }
  res.json({
    success: true,
    company,
    logs: getLogs(company.id, 100),
    ...subscriptionPayload(company.email),
  });
});

app.post("/api/companies/:id/run-daily", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const company = req.company;
    if (!requireSubscription(company, res)) return;

    appendLog(company.id, { agent: "System", message: "Daily standup started — all agents reporting..." });

    const results = await runDailyStandup(company);
    for (const r of results) {
      appendLog(company.id, { agent: r.agentName, message: r.content, ai: r.ai });
    }

    company.lastRunAt = new Date().toISOString();
    upsertCompany(company);

    res.json({ success: true, results, logs: getLogs(company.id, 50) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/companies/:id/agents/:agentId", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const company = req.company;
    if (!requireSubscription(company, res)) return;

    const { message } = req.body || {};
    const result = await runAgent(req.params.agentId, company, message || null);
    appendLog(company.id, { agent: result.agentName, message: result.content, ai: result.ai });

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/companies/:id/logs", requireAuth, requireCompanyAccess, (req, res) => {
  res.json({ success: true, logs: getLogs(req.company.id, 100) });
});

function subscriptionPayload(email) {
  const active = isSubscriptionActive(email);
  const sub = getSubscriptionByEmail(email);
  return {
    subscriptionActive: active,
    subscription: sub,
    checkoutUrl: `/checkout.html?plan=lifetime&cycle=lifetime`,
  };
}

function requireSubscription(company, res) {
  if (!company?.email) {
    res.status(400).json({ success: false, error: "Company email missing" });
    return false;
  }
  if (!isSubscriptionActive(company.email)) {
    const sub = getSubscriptionByEmail(company.email);
    const expired = sub && new Date(sub.expiresAt) <= new Date();
    res.status(402).json({
      success: false,
      error: "Subscription required",
      errorZh: expired
        ? "您的终身版已失效，请重新支付 ¥1（或 PayPal $1）开通。"
        : "请先支付 ¥1（银行卡）或 PayPal $1 开通终身版后使用全部功能。",
      expired,
      ...subscriptionPayload(company.email),
    });
    return false;
  }
  return true;
}

// ─── Static files ───
app.use(express.static(ROOT));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (req.path.includes(".")) return next();
  res.sendFile(path.join(ROOT, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Pzhisen running at ${PUBLIC_URL}`);
  console.log(`AI agents: ${isAiEnabled() ? "enabled (OpenRouter)" : "template mode — set OPENROUTER_API_KEY"}`);
});
