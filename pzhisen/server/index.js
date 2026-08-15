import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { isAiEnabled, getModels } from "./openrouter.js";
import { SUPPORTED_EMAIL_HINT, SUPPORTED_EMAIL_HINT_EN } from "./email-validator.js";
import { AGENTS, runAgent, runDailyStandup } from "./agents.js";
import {
  upsertCompany,
  getCompany,
  appendLog,
  getLogs,
  getLogCount,
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
  grantLifetimeHandler,
  notifyStatusHandler,
  notifyTestHandler,
} from "./billing.js";
import {
  isSubscriptionActive,
  getSubscriptionByEmail,
  ensureGrandfatheredLifetimeAccess,
  ensureLifetimeForEmail,
  isTrialSubscription,
  trialDaysRemaining,
  TRIAL_DAYS,
} from "./billing-store.js";
import { DEFAULT_PLAN_ID, DEFAULT_CYCLE, isValidCycle } from "./plans.js";
import {
  getMarketingDashboard,
  setRevenueGoal,
  bumpMarketingActivity,
} from "./marketing-dashboard.js";
import { getSettlementAccounts } from "./settlement-accounts.js";
import {
  getRealRevenueDashboard,
  setRealRevenueGoal,
} from "./real-revenue-dashboard.js";
import { getBankRevenueDashboard } from "./bank-revenue-dashboard.js";
import { isMerchantUser } from "./marketing-real-metrics.js";
import { grantMerchantOwner, syncEnvMerchantOwners } from "./merchant-owners-store.js";
import {
  getContentMarketingDashboard,
  setContentMarketingGoal,
  bumpContentMarketingActivity,
} from "./content-marketing-dashboard.js";
import { launchAllMarketing, getLaunchMethodsCatalog } from "./marketing-launch-all.js";
import { getMarketingAnalyticsDashboard } from "./marketing-analytics-dashboard.js";
import {
  registerHandler,
  verifyOtpHandler,
  resendOtpHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  adminRestoreUserHandler,
  requireAuth,
  requireCompanyAccess,
} from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "70mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "Pzhisen");
  next();
});

// ─── API ───
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "pzhisen", ai: isAiEnabled() });
});

app.get("/api/config", async (_req, res) => {
  res.json({
    success: true,
    publicUrl: PUBLIC_URL,
    aiEnabled: isAiEnabled(),
    models: getModels(),
    agents: Object.values(AGENTS).map((a) => ({ id: a.id, name: a.name, icon: a.icon })),
    billing: await getBillingConfig(),
    auth: {
      supportedEmailHint: SUPPORTED_EMAIL_HINT_EN,
      supportedEmailHintZh: SUPPORTED_EMAIL_HINT,
    },
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
app.get("/api/billing/config", async (_req, res) => res.json(await getBillingConfig()));
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
app.post("/api/billing/admin/grant-lifetime", grantLifetimeHandler);
app.get("/api/billing/admin/notify-status", notifyStatusHandler);
app.post("/api/billing/admin/notify-test", notifyTestHandler);
app.post("/api/auth/admin/restore-user", adminRestoreUserHandler);

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
  if (company.email) ensureLifetimeForEmail(company.email);
  const active = isSubscriptionActive(company.email);
  if (active) {
    const sub = getSubscriptionByEmail(company.email);
    const planLabel =
      sub?.cycle === "lifetime" || sub?.planId === "lifetime" ? "lifetime" : (sub?.cycle || "pro");
    if (company.plan !== planLabel) {
      company.plan = planLabel;
      upsertCompany(company);
    }
  }
  res.json({
    success: true,
    company,
    logs: getLogs(company.id, 500),
    logCount: getLogCount(company.id),
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

    bumpMarketingActivity(company.id, company, { agentId: "marketing" });
    bumpMarketingActivity(company.id, company, { agentId: "ads" });
    bumpContentMarketingActivity(company.id, company, { agentId: "marketing" });
    bumpContentMarketingActivity(company.id, company, { agentId: "ads" });

    res.json({
      success: true,
      results,
      logs: getLogs(company.id, 50),
      marketing: getMarketingDashboard(company.id, company, req.user?.email),
      contentMarketing: getContentMarketingDashboard(company.id, company, req.user?.email),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/companies/:id/agents/:agentId", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const company = req.company;
    if (!requireSubscription(company, res)) return;

    const { message, images, imageNames } = req.body || {};
    const userMessage = (message || "").trim();
    if (userMessage) {
      const agentMeta = AGENTS[req.params.agentId];
      appendLog(company.id, {
        agent: "You",
        role: "user",
        type: "question",
        agentId: req.params.agentId,
        agentName: agentMeta?.name || req.params.agentId,
        message: userMessage,
        ai: false,
      });
    }
    const result = await runAgent(req.params.agentId, company, message || null, images, {
      imageNames: imageNames || [],
    });
    const deployNote = result.deployed?.deployedImages
      ? ` [Deployed ${result.deployed.deployedImages} image(s) to ${result.agentName} backend]`
      : "";
    const answerText = result.content + deployNote;
    appendLog(company.id, {
      agent: result.agentName,
      role: "agent",
      type: "answer",
      agentId: req.params.agentId,
      question: userMessage || null,
      message: answerText,
      etaDays: result.etaDays || null,
      ai: result.ai,
    });

    bumpMarketingActivity(company.id, company, { agentId: req.params.agentId });
    bumpContentMarketingActivity(company.id, company, { agentId: req.params.agentId });

    res.json({
      success: true,
      result: { ...result, content: answerText },
      marketing: getMarketingDashboard(company.id, company, req.user?.email),
      contentMarketing: getContentMarketingDashboard(company.id, company, req.user?.email),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/companies/:id/logs", requireAuth, requireCompanyAccess, (req, res) => {
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 500), 500);
  res.json({
    success: true,
    logs: getLogs(req.company.id, limit),
    total: getLogCount(req.company.id),
  });
});

app.get("/api/companies/:id/marketing/dashboard", requireAuth, requireCompanyAccess, (req, res) => {
  res.json({
    success: true,
    marketing: getMarketingDashboard(req.company.id, req.company, req.user?.email),
  });
});

app.put("/api/companies/:id/marketing/goal", requireAuth, requireCompanyAccess, (req, res) => {
  const { revenueTarget, targetDays, currency } = req.body || {};
  setRevenueGoal(req.company.id, req.company, { revenueTarget, targetDays, currency });
  res.json({
    success: true,
    marketing: getMarketingDashboard(req.company.id, req.company, req.user?.email),
  });
});

app.get("/api/billing/settlement-accounts", requireAuth, (_req, res) => {
  res.json({ success: true, settlement: getSettlementAccounts() });
});

app.get("/api/companies/:id/revenue/real", requireAuth, requireCompanyAccess, (req, res) => {
  res.json({
    success: true,
    revenue: getRealRevenueDashboard(req.company.id, req.company, req.user?.email),
  });
});

app.put("/api/companies/:id/revenue/goal", requireAuth, requireCompanyAccess, (req, res) => {
  const { revenueTarget, targetDays, currency } = req.body || {};
  setRealRevenueGoal(req.company.id, { revenueTarget, targetDays, currency });
  res.json({
    success: true,
    revenue: getRealRevenueDashboard(req.company.id, req.company, req.user?.email),
  });
});

app.get("/api/companies/:id/revenue/bank", requireAuth, requireCompanyAccess, (req, res) => {
  res.json({
    success: true,
    bankRevenue: getBankRevenueDashboard(req.company.id, req.company, req.user?.email),
  });
});

/** Merchant bank revenue — resolves company from logged-in user (for bank-revenue.html login entry). */
app.get("/api/revenue/bank", requireAuth, (req, res) => {
  const email = req.user?.email;
  if (!isMerchantUser(email)) {
    return res.json({
      success: true,
      bankRevenue: getBankRevenueDashboard(null, null, email),
    });
  }
  const company = findCompanyByEmail(email) || (req.user?.companyId ? getCompany(req.user.companyId) : null);
  if (!company) {
    return res.json({
      success: true,
      bankRevenue: {
        isMerchant: true,
        accessMessage: "商户账户已登录，但未找到关联网站。请先在仪表盘创建公司。",
        summary: null,
        updatedAt: new Date().toISOString(),
      },
    });
  }
  res.json({
    success: true,
    bankRevenue: getBankRevenueDashboard(company.id, company, email),
  });
});

/** Claim merchant access after bank-revenue registration/login (retroactive fix). */
app.post("/api/revenue/bank/claim-merchant", requireAuth, (req, res) => {
  const email = req.user?.email;
  if (!email) return res.status(401).json({ success: false, error: "请先登录" });

  if (isMerchantUser(email)) {
    grantMerchantOwner(email);
    return res.json({ success: true, granted: true, email });
  }

  const company = findCompanyByEmail(email) || (req.user?.companyId ? getCompany(req.user.companyId) : null);
  const fromBankRegistration = company?.idea?.includes("商户收账");
  if (fromBankRegistration) {
    grantMerchantOwner(email);
    return res.json({ success: true, granted: true, email, retroactive: true });
  }

  res.json({
    success: true,
    granted: false,
    message:
      "登录成功，但该邮箱尚未开通商户收账权限。请使用 ORDER_NOTIFY_EMAIL 或 MERCHANT_OWNER_EMAILS 中配置的商户邮箱。",
  });
});

app.get("/api/companies/:id/content-marketing/dashboard", requireAuth, requireCompanyAccess, (req, res) => {
  res.json({
    success: true,
    contentMarketing: getContentMarketingDashboard(req.company.id, req.company, req.user?.email),
  });
});

app.put("/api/companies/:id/content-marketing/goal", requireAuth, requireCompanyAccess, (req, res) => {
  const { revenueTarget, targetDays, currency } = req.body || {};
  setContentMarketingGoal(req.company.id, req.company, { revenueTarget, targetDays, currency });
  res.json({
    success: true,
    contentMarketing: getContentMarketingDashboard(req.company.id, req.company, req.user?.email),
  });
});

app.get("/api/companies/:id/marketing/launch-catalog", requireAuth, requireCompanyAccess, (_req, res) => {
  res.json({ success: true, catalog: getLaunchMethodsCatalog() });
});

app.get("/api/companies/:id/marketing/analytics/daily", requireAuth, requireCompanyAccess, (req, res) => {
  res.json({
    success: true,
    analytics: getMarketingAnalyticsDashboard(req.company.id, req.company, req.user?.email),
  });
});

app.post("/api/companies/:id/marketing/launch-all", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const company = req.company;
    if (!requireSubscription(company, res)) return;

    appendLog(company.id, {
      agent: "System",
      message: `🚀 一键启动全渠道推广 — 正在部署 ${getLaunchMethodsCatalog().total} 种零成本推广方式…`,
    });

    const result = await launchAllMarketing(company.id, company, { runAiAgents: true });

    for (const r of result.launch.agentResults || []) {
      appendLog(company.id, {
        agent: r.agentName,
        role: "agent",
        type: "answer",
        message: r.preview + (r.preview?.length >= 200 ? "…" : ""),
        ai: r.ai,
        etaDays: r.etaDays,
      });
    }

    appendLog(company.id, {
      agent: "System",
      message: `✅ 全渠道推广已启动：${result.launch.methodsTotal} 种方式已部署，Marketing ${result.launch.marketingProgress}% · 内容营销 ${result.launch.contentMarketingProgress}%`,
    });

    company.lastRunAt = new Date().toISOString();
    upsertCompany(company);

    res.json({
      success: true,
      ...result,
      analytics: getMarketingAnalyticsDashboard(company.id, company, req.user?.email),
      logs: getLogs(company.id, 50),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function subscriptionPayload(email) {
  const active = isSubscriptionActive(email);
  const sub = getSubscriptionByEmail(email);
  const onTrial = active && isTrialSubscription(sub);
  const cycle = isValidCycle(sub?.cycle) ? sub.cycle : DEFAULT_CYCLE;
  return {
    subscriptionActive: active,
    subscription: sub,
    onTrial,
    trialDays: TRIAL_DAYS,
    trialDaysLeft: onTrial ? trialDaysRemaining(sub) : 0,
    checkoutUrl: `/checkout.html?plan=${DEFAULT_PLAN_ID}&cycle=${cycle}`,
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
    const trialEnded = expired && (sub?.cycle === "trial" || sub?.trialUsed);
    res.status(402).json({
      success: false,
      error: "Subscription required",
      errorZh: trialEnded
        ? `免费 ${TRIAL_DAYS} 天体验已结束。请订阅月付（¥699 / $99）或年付（¥6999 / $999）后继续使用全部功能。`
        : expired
          ? "您的订阅已到期，请续费月付（¥699 / $99）或年付（¥6999 / $999）后继续使用。"
          : "请先订阅专业版（月付或年付）后使用全部功能。中国内地可用银行卡转账，海外用户可用 PayPal。",
      expired,
      trialEnded,
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
  syncEnvMerchantOwners();
  const restored = ensureGrandfatheredLifetimeAccess();
  if (restored.length) {
    console.log(`Restored lifetime access for: ${restored.map((s) => s.email).join(", ")}`);
  }
  console.log(`Pzhisen running at ${PUBLIC_URL}`);
  console.log(`AI agents: ${isAiEnabled() ? "enabled (OpenRouter)" : "template mode — set OPENROUTER_API_KEY"}`);
});
