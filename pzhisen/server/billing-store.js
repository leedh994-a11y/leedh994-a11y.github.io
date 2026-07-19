import { loadJson, saveJson, updateCompaniesPlanByEmail } from "./store.js";

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

export function activateLifetime({ email, planId, provider, externalId }) {
  const sub = {
    email: email.trim().toLowerCase(),
    planId: planId || "lifetime",
    cycle: "lifetime",
    provider,
    externalId: externalId || null,
    status: "active",
    activatedAt: new Date().toISOString(),
    expiresAt: "2099-12-31T23:59:59.000Z",
  };
  const data = getSubscriptions();
  const idx = data.subscriptions.findIndex((s) => s.email === sub.email);
  if (idx >= 0) data.subscriptions[idx] = { ...data.subscriptions[idx], ...sub };
  else data.subscriptions.push(sub);
  saveSubscriptions(data);
  updateCompaniesPlanByEmail(sub.email, "lifetime");
  return sub;
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
