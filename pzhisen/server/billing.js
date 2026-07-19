import { listPlans } from "./plans.js";
import {
  getSubscriptionByEmail,
  isSubscriptionActive,
  activateFreeLifetime,
} from "./billing-store.js";

const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:3000";

export function getBillingConfig() {
  return {
    success: true,
    freeForever: true,
    paymentRequired: false,
    providers: {},
    publicUrl: PUBLIC_URL,
    noteZh: "Pzhisen 永久免费 — 全部功能终身可用，无需付款。",
    noteEn: "Pzhisen is free forever — all features, no payment required.",
  };
}

export function getPlansHandler(_req, res) {
  res.json({ success: true, plans: listPlans() });
}

export function getSubscriptionStatus(req, res) {
  const email = (req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ success: false, error: "Email required" });
  const sub = getSubscriptionByEmail(email) || activateFreeLifetime(email);
  res.json({
    success: true,
    active: true,
    freeForever: true,
    subscription: sub,
  });
}

export async function checkoutHandler(_req, res) {
  res.json({
    success: true,
    freeForever: true,
    message: "Pzhisen is free forever. No payment needed.",
    redirectUrl: "/#signin",
  });
}

export async function capturePayPalHandler(_req, res) {
  res.json({ success: true, freeForever: true, message: "No payment required" });
}

export async function orderStatusHandler(_req, res) {
  res.json({ success: true, active: true, freeForever: true });
}

export function confirmBankTransferHandler(_req, res) {
  res.json({ success: true, freeForever: true, message: "No payment required" });
}

export function listPendingBankOrdersHandler(_req, res) {
  res.json({ success: true, orders: [] });
}

export function approveBankOrderHandler(_req, res) {
  res.json({ success: true, freeForever: true });
}
