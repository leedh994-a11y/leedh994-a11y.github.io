import { loadJson, saveJson } from "./store.js";
import { TRIAL_DAYS } from "./plans.js";

function ordersFile() {
  return "orders.json";
}

function subsFile() {
  return "subscriptions.json";
}

export function getOrders() {
  return loadJson(ordersFile(), { orders: [] });
}

export function saveOrders(data) {
  saveJson(ordersFile(), data);
}

export function getSubscriptions() {
  return loadJson(subsFile(), { subscriptions: [] });
}

export function saveSubscriptions(data) {
  saveJson(subsFile(), data);
}

export function createOrderId() {
  return `sitp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createPendingOrder({ email, planId, cycle, amount, currency, provider, externalId, meta = {} }) {
  const order = {
    id: createOrderId(),
    email: email.trim().toLowerCase(),
    planId,
    cycle,
    amount,
    currency,
    provider,
    externalId: externalId || null,
    status: "pending",
    meta,
    createdAt: new Date().toISOString(),
  };
  const data = getOrders();
  data.orders.push(order);
  saveOrders(data);
  return order;
}

export function getOrder(orderId) {
  const { orders } = getOrders();
  return (
    orders.find((o) => o.id === orderId) ||
    orders.find((o) => o.externalId === orderId) ||
    null
  );
}

export function updateOrder(orderId, patch) {
  const data = getOrders();
  const idx = data.orders.findIndex((o) => o.id === orderId || o.externalId === orderId);
  if (idx < 0) return null;
  data.orders[idx] = { ...data.orders[idx], ...patch, updatedAt: new Date().toISOString() };
  saveOrders(data);
  return data.orders[idx];
}

function computeExpiresAt(cycle, existingSub = null) {
  const days = cycle === "yearly" ? 365 : cycle === "onetime" ? 3650 : 30;
  const now = Date.now();
  let base = now;
  if (existingSub?.currentPeriodEnd && existingSub.cycle !== "trial") {
    const current = new Date(existingSub.currentPeriodEnd).getTime();
    if (current > now) base = current;
  }
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

export function getSubscriptionByEmail(email) {
  const normalized = (email || "").trim().toLowerCase();
  const { subscriptions } = getSubscriptions();
  return subscriptions.find((s) => s.email === normalized) || null;
}

export function isSubscriptionActive(email) {
  const sub = getSubscriptionByEmail(email);
  if (!sub) return false;
  if (sub.status === "trialing" || sub.status === "active") {
    if (!sub.currentPeriodEnd) return true;
    return new Date(sub.currentPeriodEnd) > new Date();
  }
  return false;
}

export function activateTrial({ email, planId, cycle }) {
  const normalized = email.trim().toLowerCase();
  const existing = getSubscriptionByEmail(normalized);
  if (existing?.trialUsed) return existing;

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const sub = {
    id: `sub_${Date.now()}`,
    email: normalized,
    planId: planId || "growth",
    cycle: cycle || "monthly",
    status: "trialing",
    trialUsed: true,
    trialEndsAt,
    currentPeriodEnd: trialEndsAt,
    activatedAt: now.toISOString(),
    provider: "trial",
  };

  const data = getSubscriptions();
  const idx = data.subscriptions.findIndex((s) => s.email === normalized);
  if (idx >= 0) data.subscriptions[idx] = { ...data.subscriptions[idx], ...sub };
  else data.subscriptions.push(sub);
  saveSubscriptions(data);
  return sub;
}

export function activateSubscription({ email, planId, cycle, provider, externalId }) {
  const normalized = email.trim().toLowerCase();
  const existing = getSubscriptionByEmail(normalized);
  const now = new Date();
  const currentPeriodEnd = computeExpiresAt(cycle, existing);

  const sub = {
    id: existing?.id || `sub_${Date.now()}`,
    email: normalized,
    planId,
    cycle,
    status: "active",
    provider: provider || "paypal",
    externalId: externalId || null,
    trialUsed: existing?.trialUsed || false,
    activatedAt: existing?.activatedAt || now.toISOString(),
    renewedAt: now.toISOString(),
    currentPeriodEnd,
  };

  const data = getSubscriptions();
  const idx = data.subscriptions.findIndex((s) => s.email === normalized);
  if (idx >= 0) data.subscriptions[idx] = { ...data.subscriptions[idx], ...sub };
  else data.subscriptions.push(sub);
  saveSubscriptions(data);
  return sub;
}

export function cancelSubscription(email) {
  const normalized = email.trim().toLowerCase();
  const data = getSubscriptions();
  const idx = data.subscriptions.findIndex((s) => s.email === normalized);
  if (idx < 0) return null;
  data.subscriptions[idx] = {
    ...data.subscriptions[idx],
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
  };
  saveSubscriptions(data);
  return data.subscriptions[idx];
}
