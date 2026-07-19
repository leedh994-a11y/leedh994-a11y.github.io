import { loadJson, saveJson, updateCompaniesPlanByEmail } from "./store.js";
import { getCycle, isValidCycle } from "./plans.js";

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
  return `pzh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createPendingOrder({ email, planId, cycle, amount, currency, provider, meta = {} }) {
  const order = {
    id: createOrderId(),
    email: email.trim().toLowerCase(),
    planId,
    cycle,
    amount,
    currency,
    provider,
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
  return orders.find((o) => o.id === orderId) || null;
}

export function updateOrder(orderId, patch) {
  const data = getOrders();
  const idx = data.orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;
  data.orders[idx] = { ...data.orders[idx], ...patch, updatedAt: new Date().toISOString() };
  saveOrders(data);
  return data.orders[idx];
}

function computeExpiresAt(cycle, existingSub = null) {
  const meta = getCycle(cycle);
  const days = meta?.days || 30;
  const now = Date.now();
  let base = now;
  if (existingSub?.expiresAt) {
    const current = new Date(existingSub.expiresAt).getTime();
    if (current > now) base = current;
  }
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

export function activateSubscription({ email, planId, cycle, provider, externalId }) {
  const normalized = email.trim().toLowerCase();
  const validCycle = isValidCycle(cycle) ? cycle : "monthly";
  const existing = getSubscriptionByEmail(normalized);
  const expiresAt = computeExpiresAt(validCycle, existing);

  const sub = {
    email: normalized,
    planId: planId || "pro",
    cycle: validCycle,
    provider,
    externalId: externalId || null,
    status: "active",
    activatedAt: existing?.activatedAt || new Date().toISOString(),
    renewedAt: new Date().toISOString(),
    expiresAt,
  };

  const data = getSubscriptions();
  const idx = data.subscriptions.findIndex((s) => s.email === normalized);
  if (idx >= 0) data.subscriptions[idx] = { ...data.subscriptions[idx], ...sub };
  else data.subscriptions.push(sub);
  saveSubscriptions(data);
  updateCompaniesPlanByEmail(normalized, validCycle);
  return sub;
}

/** @deprecated Legacy lifetime activations — kept for old data reads only */
export function activateLifetime({ email, planId, provider, externalId }) {
  return activateSubscription({
    email,
    planId: planId || "pro",
    cycle: "annual",
    provider,
    externalId,
  });
}

export function getSubscriptionByEmail(email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const { subscriptions } = getSubscriptions();
  return subscriptions.find((s) => s.email === normalized) || null;
}

export function isSubscriptionActive(email) {
  const sub = getSubscriptionByEmail(email);
  if (!sub || sub.status !== "active") return false;
  return new Date(sub.expiresAt) > new Date();
}
