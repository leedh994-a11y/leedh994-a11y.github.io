const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
const MODE = process.env.PAYPAL_MODE || "sandbox";
const BASE = MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

let tokenCache = { token: null, expiresAt: 0 };

export function isPayPalConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function getPayPalPublicConfig() {
  return {
    configured: isPayPalConfigured(),
    clientId: CLIENT_ID || null,
    mode: MODE,
    sdkUrl: CLIENT_ID
      ? `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&currency=USD&intent=capture&vault=true`
      : null,
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
  if (!res.ok) throw new Error(data.error_description || data.error || "PayPal auth failed");

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
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
