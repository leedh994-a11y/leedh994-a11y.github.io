const CLIENT_ID = (process.env.PAYPAL_CLIENT_ID || "").trim();
const CLIENT_SECRET = (process.env.PAYPAL_CLIENT_SECRET || "").trim();
const MODE = (process.env.PAYPAL_MODE || "live").trim().toLowerCase();
const IS_LIVE = MODE === "live";
const BASE = IS_LIVE ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const SDK_HOST = IS_LIVE ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";

let tokenCache = { token: null, expiresAt: 0 };

export function isPayPalConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function getPayPalPublicConfig() {
  const configured = isPayPalConfigured();
  return {
    success: true,
    environment: IS_LIVE ? "production" : "sandbox",
    configured,
    mode: "oauth",
    clientId: CLIENT_ID || null,
    sdkUrl: CLIENT_ID
      ? `${SDK_HOST}/sdk/js?client-id=${encodeURIComponent(CLIENT_ID)}&currency=USD&intent=capture`
      : null,
    hasClientId: Boolean(CLIENT_ID),
    hasSecret: Boolean(CLIENT_SECRET),
    readyForPayments: configured,
  };
}

export async function getPayPalStatus() {
  const cfg = getPayPalPublicConfig();
  let ok = false;
  let message = "未配置";
  if (configured()) {
    try {
      await getAccessToken();
      ok = true;
      message = "连接成功";
    } catch (err) {
      message = err.message;
    }
  }
  return {
    success: true,
    ok,
    message,
    environment: cfg.environment,
    mode: cfg.mode,
    baseUrl: BASE,
    clientId: CLIENT_ID || null,
    configured: cfg.configured,
    sdkUrl: cfg.sdkUrl,
    hasClientId: cfg.hasClientId,
    hasSecret: cfg.hasSecret,
  };
}

function configured() {
  return isPayPalConfigured();
}

async function getAccessToken() {
  if (!isPayPalConfigured()) throw new Error("PayPal not configured");
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "PayPal auth failed");

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

export async function createPayPalOrder({ amount, currency = "USD", description, email, planId, returnUrl, cancelUrl }) {
  const token = await getAccessToken();
  const value = Number(amount).toFixed(2);

  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        description: description?.slice(0, 127) || "Sitp GPT subscription",
        amount: { currency_code: currency, value },
        custom_id: [planId, email].filter(Boolean).join(":").slice(0, 127),
      }],
      application_context: {
        brand_name: "Sitp GPT",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.details?.[0]?.description || "PayPal order failed");
  }

  const approveUrl = data.links?.find((l) => l.rel === "approve")?.href;
  return { orderId: data.id, status: data.status, approveUrl, raw: data };
}

export async function capturePayPalOrder(paypalOrderId) {
  if (!paypalOrderId) return { success: false, error: "缺少 orderId" };

  const token = await getAccessToken();
  const res = await fetch(`${BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data.message || data.details?.[0]?.description || "PayPal capture failed";
    return { success: false, error: msg };
  }

  const captureId =
    data.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
    data.id ||
    paypalOrderId;

  return { success: true, captureId, status: data.status, raw: data };
}
