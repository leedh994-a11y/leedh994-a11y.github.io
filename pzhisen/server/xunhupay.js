import crypto from "crypto";

const APP_ID = process.env.XUNHU_APP_ID || "";
const APP_SECRET = process.env.XUNHU_APP_SECRET || "";
const API_URL = process.env.XUNHU_API_URL || "https://api.xunhupay.com/payment/do.html";

export function isXunhuConfigured() {
  return Boolean(APP_ID && APP_SECRET);
}

function md5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

function sign(params, secret) {
  const keys = Object.keys(params).filter((k) => k !== "hash" && params[k] != null && params[k] !== "")
    .sort();
  const str = keys.map((k) => `${k}=${params[k]}`).join("&") + secret;
  return md5(str);
}

/**
 * Create WeChat / Alipay payment via 虎皮椒 (XunhuPay).
 * Funds settle to your Xunhu account → linked WeChat / Alipay merchant wallet.
 * Bank cards: users pay through Alipay (supports debit/credit cards).
 */
export async function createXunhuPayment({
  orderId,
  amountCny,
  title,
  notifyUrl,
  returnUrl,
  type = "wechat", // wechat | alipay
}) {
  if (!isXunhuConfigured()) throw new Error("XunhuPay not configured");

  const params = {
    version: "1.1",
    appid: APP_ID,
    trade_order_id: orderId,
    total_fee: Number(amountCny).toFixed(2),
    title: title.slice(0, 42),
    time: Math.floor(Date.now() / 1000).toString(),
    notify_url: notifyUrl,
    return_url: returnUrl,
    callback_url: returnUrl,
    nonce_str: crypto.randomBytes(8).toString("hex"),
    type: type === "alipay" ? "alipay" : "wechat",
    wap_url: returnUrl,
    wap_name: "Pzhisen",
  };
  params.hash = sign(params, APP_SECRET);

  const body = new URLSearchParams(params);
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`XunhuPay invalid response: ${text.slice(0, 200)}`);
  }

  if (data.errcode !== 0 && data.errcode !== "0") {
    throw new Error(data.errmsg || data.err_msg || "XunhuPay order failed");
  }

  return {
    payUrl: data.url || data.url_qrcode,
    qrcodeUrl: data.url_qrcode,
    raw: data,
  };
}

export function verifyXunhuNotify(body) {
  if (!isXunhuConfigured()) return { valid: false, error: "Not configured" };
  const params = { ...body };
  const received = params.hash;
  delete params.hash;
  const expected = sign(params, APP_SECRET);
  if (received !== expected) return { valid: false, error: "Invalid signature" };

  const status = params.status;
  const orderId = params.trade_order_id;
  const paid = status === "OD" || status === "paid" || params.open_order_id;
  return { valid: true, paid, orderId, externalId: params.transaction_id || params.open_order_id };
}
