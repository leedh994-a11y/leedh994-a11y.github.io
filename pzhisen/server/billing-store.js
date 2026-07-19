import crypto from "crypto";
import { loadJson, saveJson } from "./store.js";

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
  return `pzh_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
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

export function activateSubscription({ email, planId, cycle, provider, externalId, days }) {
  const now = new Date();
  const existing = getSubscriptionByEmail(email);
  const base = existing?.expiresAt && new Date(existing.expiresAt) > now
    ? new Date(existing.expiresAt)
    : now;
  const expiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  const sub = {
    email: email.trim().toLowerCase(),
    planId,
    cycle,
    provider,
    externalId: externalId || null,
    status: "active",
    activatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const data = getSubscriptions();
  const idx = data.subscriptions.findIndex((s) => s.email === sub.email);
  if (idx >= 0) data.subscriptions[idx] = { ...data.subscriptions[idx], ...sub };
  else data.subscriptions.push(sub);
  saveSubscriptions(data);
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

export function subscriptionDaysForCycle(cycle) {
  return cycle === "yearly" ? 365 : 30;
}
