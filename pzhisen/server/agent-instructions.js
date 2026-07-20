import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { loadJson, saveJson } from "./store.js";
import { parseDataUrl, mimeToExtension } from "./image-chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const ASSETS_ROOT = path.join(DATA_DIR, "agent-assets");
const STORE_FILE = "agent-instructions.json";
const MAX_DEPLOYED_IMAGES_PER_AGENT = 10;
const MAX_DIRECTIVES_PER_AGENT = 50;

function ensureAssetsDir() {
  if (!fs.existsSync(ASSETS_ROOT)) fs.mkdirSync(ASSETS_ROOT, { recursive: true });
}

function store() {
  return loadJson(STORE_FILE, { companies: {} });
}

function saveStore(data) {
  saveJson(STORE_FILE, data);
}

function companyBucket(data, companyId) {
  if (!data.companies[companyId]) {
    data.companies[companyId] = { agents: {} };
  }
  return data.companies[companyId];
}

function agentBucket(company, agentId) {
  if (!company.agents[agentId]) {
    company.agents[agentId] = { directives: [], images: {} };
  }
  return company.agents[agentId];
}

function hashDataUrl(dataUrl) {
  return crypto.createHash("sha256").update(dataUrl).digest("hex").slice(0, 16);
}

function saveImageFile(companyId, agentId, dataUrl, name) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  ensureAssetsDir();
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ext = mimeToExtension(parsed.mime);
  const rel = `${companyId}/${agentId}/${id}.${ext}`;
  const full = path.join(ASSETS_ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, Buffer.from(parsed.base64, "base64"));

  return {
    id,
    path: rel,
    mime: parsed.mime,
    name: name || `${id}.${ext}`,
    hash: hashDataUrl(dataUrl),
    deployedAt: new Date().toISOString(),
  };
}

function loadImageDataUrl(asset) {
  const full = path.join(ASSETS_ROOT, asset.path);
  if (!fs.existsSync(full)) return null;
  const base64 = fs.readFileSync(full).toString("base64");
  return `data:${asset.mime};base64,${base64}`;
}

function trimAgentAssets(agent) {
  const imageIds = Object.keys(agent.images);
  if (imageIds.length > MAX_DEPLOYED_IMAGES_PER_AGENT) {
    const remove = imageIds
      .sort((a, b) => new Date(agent.images[a].deployedAt) - new Date(agent.images[b].deployedAt))
      .slice(0, imageIds.length - MAX_DEPLOYED_IMAGES_PER_AGENT);
    for (const id of remove) {
      const asset = agent.images[id];
      const full = path.join(ASSETS_ROOT, asset.path);
      if (fs.existsSync(full)) fs.unlinkSync(full);
      delete agent.images[id];
    }
  }
  if (agent.directives.length > MAX_DIRECTIVES_PER_AGENT) {
    agent.directives = agent.directives.slice(-MAX_DIRECTIVES_PER_AGENT);
  }
}

/** Persist chat text + images into the agent's backend instruction program. */
export function deployChatToAgent(companyId, agentId, { message, images = [], imageNames = [] }) {
  const data = store();
  const company = companyBucket(data, companyId);
  const agent = agentBucket(company, agentId);

  const deployedImageIds = [];
  for (let i = 0; i < images.length; i++) {
    const dataUrl = images[i];
    const hash = hashDataUrl(dataUrl);
    const existing = Object.values(agent.images).find((img) => img.hash === hash);
    if (existing) {
      deployedImageIds.push(existing.id);
      continue;
    }
    const saved = saveImageFile(companyId, agentId, dataUrl, imageNames[i]);
    if (!saved) continue;
    agent.images[saved.id] = saved;
    deployedImageIds.push(saved.id);
  }

  trimAgentAssets(agent);

  if (message?.trim() || deployedImageIds.length) {
    agent.directives.push({
      id: `dir_${Date.now()}`,
      text: message?.trim() || "",
      imageIds: deployedImageIds,
      deployedAt: new Date().toISOString(),
    });
    if (agent.directives.length > MAX_DIRECTIVES_PER_AGENT) {
      agent.directives = agent.directives.slice(-MAX_DIRECTIVES_PER_AGENT);
    }
  }

  saveStore(data);
  return {
    deployedImages: deployedImageIds.length,
    totalImages: Object.keys(agent.images).length,
    totalDirectives: agent.directives.length,
  };
}

/** Build backend instruction context + vision images for agent runs. */
export function getAgentDeployContext(companyId, agentId) {
  const data = store();
  const company = data.companies[companyId];
  if (!company?.agents[agentId]) {
    return { instructionText: "", imageDataUrls: [], deployedImageCount: 0 };
  }

  const agent = company.agents[agentId];
  const lines = [];
  for (const dir of agent.directives) {
    const when = new Date(dir.deployedAt).toISOString().slice(0, 16).replace("T", " ");
    const imgNote = dir.imageIds?.length ? ` [${dir.imageIds.length} image(s)]` : "";
    const text = dir.text || "(image-only instruction)";
    lines.push(`[${when}]${imgNote} ${text}`);
  }

  const imageDataUrls = [];
  for (const asset of Object.values(agent.images)) {
    const url = loadImageDataUrl(asset);
    if (url) imageDataUrls.push(url);
  }

  const instructionText = lines.length
    ? `Deployed dashboard instructions (apply these in your code/output):\n${lines.join("\n")}`
    : "";

  return {
    instructionText,
    imageDataUrls,
    deployedImageCount: imageDataUrls.length,
  };
}

export function getAgentDeploySummary(companyId, agentId) {
  const ctx = getAgentDeployContext(companyId, agentId);
  return {
    imageCount: ctx.deployedImageCount,
    directiveCount: ctx.instructionText ? ctx.instructionText.split("\n").length - 1 : 0,
  };
}
