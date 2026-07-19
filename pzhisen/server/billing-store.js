import { loadJson, saveJson, updateCompaniesPlanByEmail } from "./store.js";
import { isValidCycle } from "./plans.js";

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

function addPeriod(fromDate, cycle) {
  const d = new Date(fromDate);
  if (cycle === "monthly") d.setMonth(d.getMonth() + 1);
  else if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

export function activateSubscription({ email, planId, cycle, provider, externalId }) {
  if (!isValidCycle(cycle)) throw new Error("Invalid subscription cycle");

  const normalized = email.trim().toLowerCase();
  const existing = getSubscriptionByEmail(normalized);
  const now = new Date();
  let base = now;
  if (existing?.status === "active" && new Date(existing.expiresAt) > now) {
    base = new Date(existing.expiresAt);
  }

  const sub = {
    email: normalized,
    planId: planId || "pro",
    cycle,
    provider,
    externalId: externalId || null,
    status: "active",
    activatedAt: now.toISOString(),
    expiresAt: addPeriod(base, cycle),
  };

  const data = getSubscriptions();
  const idx = data.subscriptions.findIndex((s) => s.email === normalized);
  if (idx >= 0) data.subscriptions[idx] = { ...data.subscriptions[idx], ...sub };
  else data.subscriptions.push(sub);
  saveSubscriptions(data);
  updateCompaniesPlanByEmail(normalized, cycle);
  return sub;
}

/** @deprecated Use activateSubscription */
export function activateLifetime(args) {
  return activateSubscription({ ...args, cycle: args.cycle || "yearly" });
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
