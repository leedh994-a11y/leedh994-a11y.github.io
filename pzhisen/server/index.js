import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { isAiEnabled, getModels } from "./openrouter.js";
import { AGENTS, runAgent, runDailyStandup, runCeoOnboarding } from "./agents.js";
import {
  upsertCompany,
  getCompany,
  appendLog,
  getLogs,
  getGlobalLogs,
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

const app = express();
app.use(cors());
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

// ─── Billing / subscriptions ───
app.get("/api/billing/config", (_req, res) => res.json(getBillingConfig()));
app.get("/api/billing/plans", getPlansHandler);
app.get("/api/billing/subscription", getSubscriptionStatus);
app.post("/api/billing/checkout", checkoutHandler);
app.post("/api/billing/paypal/capture", capturePayPalHandler);
app.get("/api/billing/order/:orderId", orderStatusHandler);
app.post("/api/billing/bank/confirm", confirmBankTransferHandler);
app.get("/api/billing/admin/pending", listPendingBankOrdersHandler);
app.post("/api/billing/admin/approve", approveBankOrderHandler);

app.get("/api/logs/global", (_req, res) => {
  res.json({ success: true, logs: getGlobalLogs(40) });
});

app.post("/api/signup", async (req, res) => {
  try {
    const { email, idea, name } = req.body || {};
    if (!email?.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }
    if (!idea?.trim()) {
      return res.status(400).json({ success: false, error: "Business idea required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const sub = getSubscriptionByEmail(normalizedEmail);
    const subActive = isSubscriptionActive(normalizedEmail);
    const company = {
      id: uuidv4(),
      email: normalizedEmail,
      name: (name || idea.split(" ").slice(0, 3).join(" ")).trim().slice(0, 80),
      idea: idea.trim().slice(0, 2000),
      industry: inferIndustry(idea),
      stage: "idea",
      createdAt: new Date().toISOString(),
      status: "active",
      plan: subActive ? (sub?.cycle || "pro") : "trial",
    };

    upsertCompany(company);
    appendLog(company.id, { agent: "System", message: `Company "${company.name}" created. Deploying AI team...` });

    const ceoBrief = await runCeoOnboarding(company);
    appendLog(company.id, {
      agent: ceoBrief.agentName,
      message: ceoBrief.content,
      ai: ceoBrief.ai,
    });

    res.json({
      success: true,
      company,
      subscriptionActive: subActive,
      redirectUrl: `/dashboard.html?company=${company.id}`,
      ceoBrief,
    });
  } catch (err) {
    console.error("signup error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/companies/:id", (req, res) => {
  const company = getCompany(req.params.id);
  if (!company) return res.status(404).json({ success: false, error: "Company not found" });
  const active = isSubscriptionActive(company.email);
  const sub = getSubscriptionByEmail(company.email);
  if (active && sub?.cycle && company.plan !== sub.cycle) {
    company.plan = sub.cycle;
    upsertCompany(company);
  }
  res.json({
    success: true,
    company,
    logs: getLogs(company.id, 100),
    ...subscriptionPayload(company.email),
  });
});

app.post("/api/companies/:id/run-daily", async (req, res) => {
  try {
    const company = getCompany(req.params.id);
    if (!company) return res.status(404).json({ success: false, error: "Company not found" });
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

app.post("/api/companies/:id/agents/:agentId", async (req, res) => {
  try {
    const company = getCompany(req.params.id);
    if (!company) return res.status(404).json({ success: false, error: "Company not found" });
    if (!requireSubscription(company, res)) return;

    const { message } = req.body || {};
    const result = await runAgent(req.params.agentId, company, message || null);
    appendLog(company.id, { agent: result.agentName, message: result.content, ai: result.ai });

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/companies/:id/logs", (req, res) => {
  const company = getCompany(req.params.id);
  if (!company) return res.status(404).json({ success: false, error: "Company not found" });
  res.json({ success: true, logs: getLogs(company.id, 100) });
});

function subscriptionPayload(email) {
  const active = isSubscriptionActive(email);
  const sub = getSubscriptionByEmail(email);
  return {
    subscriptionActive: active,
    subscription: sub,
    checkoutUrl: `/pricing.html?email=${encodeURIComponent(email || "")}`,
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
        ? "您的订阅已过期，请续费月付 $99 或年付 $999 后继续使用。"
        : "请先订阅月付 $99 或年付 $999 套餐后使用全部功能。",
      expired,
      ...subscriptionPayload(company.email),
    });
    return false;
  }
  return true;
}

function inferIndustry(idea) {
  const t = idea.toLowerCase();
  if (/saas|software|app|platform/.test(t)) return "SaaS";
  if (/ecommerce|shop|store|retail/.test(t)) return "E-commerce";
  if (/ai|ml|gpt|agent/.test(t)) return "AI";
  if (/health|medical/.test(t)) return "Healthcare";
  return "General";
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
