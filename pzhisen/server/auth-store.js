import { loadJson, saveJson } from "./store.js";

const FILE = "users.json";

function data() {
  return loadJson(FILE, { users: [] });
}

function save(d) {
  saveJson(FILE, d);
}

export function getUserByEmail(email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return data().users.find((u) => u.email === normalized) || null;
}

export function getUserById(id) {
  return data().users.find((u) => u.id === id) || null;
}

export function createUser({ id, email, passwordHash, companyId = null }) {
  const user = {
    id,
    email: email.trim().toLowerCase(),
    passwordHash,
    emailVerified: true,
    companyId,
    createdAt: new Date().toISOString(),
  };
  const d = data();
  d.users.push(user);
  save(d);
  return user;
}

export function updateUser(id, patch) {
  const d = data();
  const idx = d.users.findIndex((u) => u.id === id);
  if (idx < 0) return null;
  d.users[idx] = { ...d.users[idx], ...patch, updatedAt: new Date().toISOString() };
  save(d);
  return d.users[idx];
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    companyId: user.companyId,
    createdAt: user.createdAt,
  };
}
