import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import {
  getPayPalPublicConfig,
  getPayPalStatus,
  createPayPalOrder,
  capturePayPalOrder,
  isPayPalConfigured,
} from "./paypal.js";
import {
  checkoutHandler,
  activateHandler,
  captureOrderHandler,
  getSubscriptionHandler,
  cancelHandler,
  getBillingConfig,
  notifyStatusHandler,
  notifyTestHandler,
} from "./billing.js";
import { mailRelaySendHandler, mailRelayStatusHandler } from "./mail-relay.js";
import toolsApi from "./tools-api.js";
import { isAiEnabled } from "./openrouter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3456;

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "Express");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/paypal/config", (_req, res) => {
  res.json(getPayPalPublicConfig());
});

app.get("/api/paypal/status", async (_req, res) => {
  try {
    res.json(await getPayPalStatus());
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/paypal/create-order", async (req, res) => {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({ success: false, error: "PayPal not configured" });
    }
    const { amount, currency = "USD", description, email, planId } = req.body || {};
    if (!amount) return res.status(400).json({ success: false, error: "Amount required" });

    const pp = await createPayPalOrder({
      amount,
      currency,
      description,
      email,
      planId,
      returnUrl: `${process.env.PUBLIC_URL || "https://yoursite.asia"}/account.html`,
      cancelUrl: `${process.env.PUBLIC_URL || "https://yoursite.asia"}/checkout.html`,
    });

    res.json({
      success: true,
      orderId: pp.orderId,
      status: pp.status,
      approveUrl: pp.approveUrl,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/paypal/capture-order", captureOrderHandler);

app.get("/api/billing/config", getBillingConfig);
app.get("/api/billing/subscription", getSubscriptionHandler);
app.post("/api/billing/checkout", checkoutHandler);
app.post("/api/billing/activate", activateHandler);
app.post("/api/billing/cancel", cancelHandler);
app.get("/api/billing/admin/notify-status", notifyStatusHandler);
app.post("/api/billing/admin/notify-test", notifyTestHandler);

app.get("/api/mail/relay/status", mailRelayStatusHandler);
app.post("/api/mail/send", mailRelaySendHandler);

app.use("/api", toolsApi);

app.use(express.static(ROOT));

app.listen(PORT, () => {
  console.log(`Sitp GPT server listening on :${PORT}`);
  console.log(`Static root: ${ROOT}`);
  console.log(`PUBLIC_URL: ${process.env.PUBLIC_URL || "https://yoursite.asia"}`);
  console.log(`ORDER_NOTIFY_EMAIL: ${process.env.ORDER_NOTIFY_EMAIL || "ddb1520@outlook.com"}`);
  console.log(`AI (OpenRouter): ${isAiEnabled() ? "enabled" : "disabled — template/mock responses"}`);
});
