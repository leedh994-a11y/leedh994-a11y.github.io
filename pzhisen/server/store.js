import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return path.join(DATA_DIR, name);
}

export function loadJson(name, fallback = {}) {
  ensureDir();
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return fallback;
  }
}

export function saveJson(name, data) {
  ensureDir();
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

export function getCompanies() {
  return loadJson("companies.json", { companies: [] });
}

export function saveCompanies(data) {
  saveJson("companies.json", data);
}

export function getCompany(id) {
  const { companies } = getCompanies();
  return companies.find((c) => c.id === id) || null;
}

export function upsertCompany(company) {
  const data = getCompanies();
  const idx = data.companies.findIndex((c) => c.id === company.id);
  if (idx >= 0) data.companies[idx] = company;
  else data.companies.push(company);
  saveCompanies(data);
  return company;
}

export function updateCompaniesPlanByEmail(email, plan) {
  if (!email) return [];
  const normalized = email.trim().toLowerCase();
  const data = getCompanies();
  const updated = [];
  for (const company of data.companies) {
    if (company.email === normalized && company.plan !== plan) {
      company.plan = plan;
      updated.push(company);
    }
  }
  if (updated.length) saveCompanies(data);
  return updated;
}

export function findCompanyByEmail(email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const { companies } = getCompanies();
  return companies.find((c) => c.email === normalized) || null;
}

export function findCompanyByUserId(userId) {
  if (!userId) return null;
  const { companies } = getCompanies();
  return companies.find((c) => c.userId === userId) || null;
}

export function appendLog(companyId, entry) {
  const logs = loadJson(`logs-${companyId}.json`, { entries: [] });
  logs.entries.push({ ...entry, at: new Date().toISOString() });
  if (logs.entries.length > 500) logs.entries = logs.entries.slice(-500);
  saveJson(`logs-${companyId}.json`, logs);
  return entry;
}

export function getLogs(companyId, limit = 50) {
  const logs = loadJson(`logs-${companyId}.json`, { entries: [] });
  return logs.entries.slice(-limit);
}

export function getGlobalLogs(limit = 30) {
  const data = getCompanies();
  const all = [];
  for (const c of data.companies) {
    const entries = getLogs(c.id, 10);
    all.push(...entries.map((e) => ({ ...e, companyName: c.name })));
  }
  return all.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}
