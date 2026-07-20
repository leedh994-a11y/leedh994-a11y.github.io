import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { loadJson, saveJson } from "./store.js";

function connectionsFile(companyId) {
  return `oauth-connections-${companyId}.json`;
}

function pendingFile() {
  return "oauth-pending.json";
}

function getConnections(companyId) {
  return loadJson(connectionsFile(companyId), { connections: {} });
}

function saveConnections(companyId, data) {
  saveJson(connectionsFile(companyId), data);
}

export function getPlatformConnection(companyId, platformId) {
  const data = getConnections(companyId);
  return data.connections[platformId] || null;
}

export function listPlatformConnections(companyId) {
  const data = getConnections(companyId);
  return Object.entries(data.connections).map(([platformId, conn]) => ({
    platformId,
    connected: true,
    accountName: conn.accountName || null,
    connectedAt: conn.connectedAt,
    expiresAt: conn.expiresAt || null,
    meta: conn.meta || {},
  }));
}

export function savePlatformConnection(companyId, platformId, payload) {
  const data = getConnections(companyId);
  data.connections[platformId] = {
    ...payload,
    platformId,
    connectedAt: payload.connectedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveConnections(companyId, data);
  return data.connections[platformId];
}

export function removePlatformConnection(companyId, platformId) {
  const data = getConnections(companyId);
  delete data.connections[platformId];
  saveConnections(companyId, data);
}

export function saveOAuthPending(state, payload) {
  const data = loadJson(pendingFile(), { pending: {} });
  data.pending[state] = { ...payload, createdAt: Date.now() };
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [key, value] of Object.entries(data.pending)) {
    if (value.createdAt < cutoff) delete data.pending[key];
  }
  saveJson(pendingFile(), data);
}

export function consumeOAuthPending(state) {
  const data = loadJson(pendingFile(), { pending: {} });
  const item = data.pending[state];
  if (!item) return null;
  delete data.pending[state];
  saveJson(pendingFile(), data);
  if (Date.now() - item.createdAt > 15 * 60 * 1000) return null;
  return item;
}

export function createOAuthState() {
  return crypto.randomBytes(24).toString("hex");
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function newOAuthSessionId() {
  return uuidv4();
}
