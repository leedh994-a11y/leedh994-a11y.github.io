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
  grantLifetimeHandler,
} from "./billing.js";
import { isSubscriptionActive, getSubscriptionByEmail, ensureGrandfatheredLifetimeAccess, ensureLifetimeForEmail } from "./billing-store.js";
import { DEFAULT_PLAN_ID, DEFAULT_CYCLE } from "./plans.js";
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
import {
  marketingConfigHandler,
  marketingGenerateHandler,
  marketingListHandler,
  marketingGetHandler,
} from "./marketing-routes.js";
import {
  videoChatHandler,
  videoProjectsListHandler,
  videoProjectGetHandler,
  videoPublishHandler,
  videoRenderHandler,
} from "./video-routes.js";
import { getVideoPreviewPath } from "./video-studio.js";
import { getVideoMp4Path } from "./video-render.js";
import {
  oauthStatusHandler,
  oauthConnectHandler,
  oauthCallbackHandler,
  oauthDisconnectHandler,
} from "./oauth-routes.js";
import fs from "fs";

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
      supportedEmailHint: "Gmail, Outlook, Yahoo, iCloud, QQ, 163, 126, ProtonMail and all mainstream email providers worldwide",
      supportedEmailHintZh: "支持 Gmail、Outlook、Yahoo、iCloud、QQ邮箱、163邮箱、126邮箱、ProtonMail 等全球主流邮箱",
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

    const { message, images, imageNames } = req.body || {};
    const result = await runAgent(req.params.agentId, company, message || null, images, {
      imageNames: imageNames || [],
    });
    const deployNote = result.deployed?.deployedImages
      ? ` [Deployed ${result.deployed.deployedImages} image(s) to ${result.agentName} backend]`
      : "";
    appendLog(company.id, {
      agent: result.agentName,
      message: result.content + deployNote,
      ai: result.ai,
    });

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/companies/:id/logs", requireAuth, requireCompanyAccess, (req, res) => {
  res.json({ success: true, logs: getLogs(req.company.id, 100) });
});

app.get("/api/marketing/config", marketingConfigHandler);
app.get("/api/companies/:id/marketing/campaigns", requireAuth, requireCompanyAccess, (req, res) => {
  if (!requireSubscription(req.company, res)) return;
  marketingListHandler(req, res);
});
app.get("/api/companies/:id/marketing/campaigns/:campaignId", requireAuth, requireCompanyAccess, (req, res) => {
  if (!requireSubscription(req.company, res)) return;
  marketingGetHandler(req, res);
});
app.post("/api/companies/:id/marketing/generate", requireAuth, requireCompanyAccess, async (req, res) => {
  if (!requireSubscription(req.company, res)) return;
  await marketingGenerateHandler(req, res);
});

app.post("/api/companies/:id/video/chat", requireAuth, requireCompanyAccess, async (req, res) => {
  if (!requireSubscription(req.company, res)) return;
  await videoChatHandler(req, res);
});
app.get("/api/companies/:id/video/projects", requireAuth, requireCompanyAccess, (req, res) => {
  if (!requireSubscription(req.company, res)) return;
  videoProjectsListHandler(req, res);
});
app.get("/api/companies/:id/video/projects/:projectId", requireAuth, requireCompanyAccess, (req, res) => {
  if (!requireSubscription(req.company, res)) return;
  videoProjectGetHandler(req, res);
});
app.post("/api/companies/:id/video/projects/:projectId/publish", requireAuth, requireCompanyAccess, async (req, res) => {
  if (!requireSubscription(req.company, res)) return;
  await videoPublishHandler(req, res);
});
app.post("/api/companies/:id/video/projects/:projectId/render", requireAuth, requireCompanyAccess, async (req, res) => {
  if (!requireSubscription(req.company, res)) return;
  await videoRenderHandler(req, res);
});

app.get("/api/companies/:id/oauth/status", requireAuth, requireCompanyAccess, (req, res) => {
  if (!requireSubscription(req.company, res)) return;
  oauthStatusHandler(req, res);
});
app.post("/api/companies/:id/oauth/:platform/connect", requireAuth, requireCompanyAccess, (req, res) => {
  if (!requireSubscription(req.company, res)) return;
  oauthConnectHandler(req, res);
});
app.delete("/api/companies/:id/oauth/:platform", requireAuth, requireCompanyAccess, (req, res) => {
  if (!requireSubscription(req.company, res)) return;
  oauthDisconnectHandler(req, res);
});
app.get("/api/oauth/callback/:platform", oauthCallbackHandler);

app.get("/video-preview/:companyId/:file", (req, res) => {
  const projectId = req.params.file.replace(/\.html$/i, "");
  const filePath = getVideoPreviewPath(req.params.companyId, projectId);
  if (!fs.existsSync(filePath)) return res.status(404).send("Preview not found");
  res.sendFile(filePath);
});

app.get("/video-file/:companyId/:file", (req, res) => {
  const projectId = req.params.file.replace(/\.mp4$/i, "");
  const filePath = getVideoMp4Path(req.params.companyId, projectId);
  if (!fs.existsSync(filePath)) return res.status(404).send("Video not found");
  res.setHeader("Content-Type", "video/mp4");
  res.sendFile(filePath);
});

function subscriptionPayload(email) {
  const active = isSubscriptionActive(email);
  const sub = getSubscriptionByEmail(email);
  const cycle = sub?.cycle || DEFAULT_CYCLE;
  return {
    subscriptionActive: active,
    subscription: sub,
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
    res.status(402).json({
      success: false,
      error: "Subscription required",
      errorZh: expired
        ? "您的订阅已到期，请续费月付（¥699 / $99）或年付（¥6999 / $999）后继续使用。"
        : "请先订阅专业版（月付或年付）后使用全部功能。中国内地可用银行卡转账，海外用户可用 PayPal。",
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
  const restored = ensureGrandfatheredLifetimeAccess();
  if (restored.length) {
    console.log(`Restored lifetime access for: ${restored.map((s) => s.email).join(", ")}`);
  }
  console.log(`Pzhisen running at ${PUBLIC_URL}`);
  console.log(`AI agents: ${isAiEnabled() ? "enabled (OpenRouter)" : "template mode — set OPENROUTER_API_KEY"}`);
});
