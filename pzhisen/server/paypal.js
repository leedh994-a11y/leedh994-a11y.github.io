const CLIENT_ID = (process.env.PAYPAL_CLIENT_ID || "").trim();
const CLIENT_SECRET = (process.env.PAYPAL_CLIENT_SECRET || "").trim();
const MODE = (process.env.PAYPAL_MODE || "sandbox").trim().toLowerCase();
const IS_LIVE = MODE === "live";
const BASE = IS_LIVE
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";
const SDK_HOST = IS_LIVE
  ? "https://www.paypal.com"
  : "https://www.sandbox.paypal.com";

let tokenCache = { token: null, expiresAt: 0 };
let authCheckCache = { ok: null, error: null, checkedAt: 0 };

export function isPayPalConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function getPayPalPublicConfig() {
  return {
    configured: isPayPalConfigured(),
    clientId: CLIENT_ID || null,
    mode: IS_LIVE ? "live" : "sandbox",
    sdkUrl: CLIENT_ID
      ? `${SDK_HOST}/sdk/js?client-id=${encodeURIComponent(CLIENT_ID)}&currency=USD&intent=capture&components=buttons`
      : null,
    authOk: authCheckCache.ok,
    authError: authCheckCache.error,
  };
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
  if (!res.ok) {
    const msg = data.error_description || data.error || "PayPal auth failed";
    if (/invalid_client|authentication/i.test(msg)) {
      throw new Error(
        `PayPal 凭证无效（${IS_LIVE ? "live" : "sandbox"}）：请确认 PAYPAL_CLIENT_ID 与 PAYPAL_CLIENT_SECRET 来自同一应用，且 PAYPAL_MODE=${MODE} 与密钥环境一致`
      );
    }
    throw new Error(msg);
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

/** Cached server-side credential check (for diagnostics). */
export async function verifyPayPalAuth() {
  if (!isPayPalConfigured()) {
    authCheckCache = { ok: false, error: "PayPal credentials not set", checkedAt: Date.now() };
    return authCheckCache;
  }
  if (authCheckCache.checkedAt && Date.now() - authCheckCache.checkedAt < 5 * 60 * 1000) {
    return authCheckCache;
  }
  try {
    await getAccessToken();
    authCheckCache = { ok: true, error: null, checkedAt: Date.now() };
  } catch (err) {
    authCheckCache = { ok: false, error: err.message, checkedAt: Date.now() };
  }
  return authCheckCache;
}

export async function createPayPalOrder({ orderId, amount, currency, description, returnUrl, cancelUrl }) {
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
        reference_id: orderId,
        description: description?.slice(0, 127) || "Pzhisen subscription",
        amount: { currency_code: currency, value },
      }],
      application_context: {
        brand_name: "Pzhisen",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.details?.[0]?.description || "PayPal order failed");

  const approve = data.links?.find((l) => l.rel === "approve")?.href;
  return { paypalOrderId: data.id, approveUrl: approve, raw: data };
}

export async function capturePayPalOrder(paypalOrderId) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.details?.[0]?.description || "PayPal capture failed");

  const status = data.status;
  const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  return { success: status === "COMPLETED", status, captureId, raw: data };
}
