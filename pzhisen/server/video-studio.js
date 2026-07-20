import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadJson, saveJson, appendLog } from "./store.js";
import { MARKETING_PLATFORMS } from "./platforms.js";
import { ZERO_COST_MARKETING_POLICY } from "./marketing-policy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const PREVIEW_DIR = path.join(DATA_DIR, "video-previews");

export const VIDEO_PLATFORM_IDS = [
  "youtube",
  "tiktok",
  "x",
  "facebook",
  "wechat_channels",
  "douyin",
  "kuaishou",
  "xiaohongshu",
  "tencent_video",
  "qq_zone",
];

function projectsFile(companyId) {
  return `video-projects-${companyId}.json`;
}

function sessionsFile(companyId) {
  return `video-chat-sessions-${companyId}.json`;
}

function getProjects(companyId) {
  return loadJson(projectsFile(companyId), { projects: [] });
}

function saveProjects(companyId, data) {
  saveJson(projectsFile(companyId), data);
}

function getSessions(companyId) {
  return loadJson(sessionsFile(companyId), { sessions: {} });
}

function saveSessions(companyId, data) {
  saveJson(sessionsFile(companyId), data);
}

function ensurePreviewDir() {
  if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });
}

function detectPlatformsFromText(text) {
  const t = (text || "").toLowerCase();
  const found = new Set();
  const map = {
    youtube: ["youtube"],
    tiktok: ["tiktok"],
    x: ["x", "twitter", "推特"],
    facebook: ["facebook"],
    wechat_channels: ["视频号", "wechat channels", "channels"],
    douyin: ["抖音", "douyin"],
    kuaishou: ["快手", "kuaishou"],
    xiaohongshu: ["小红书", "xiaohongshu", "red"],
    tencent_video: ["腾讯视频", "tencent video"],
    qq_zone: ["qq", "qq空间"],
  };
  for (const [id, keys] of Object.entries(map)) {
    if (keys.some((k) => t.includes(k.toLowerCase()))) found.add(id);
  }
  return [...found];
}

function buildPreviewHtml(project) {
  const scenes = project.video?.scenes || [];
  const slides = scenes.length
    ? scenes
    : [{ time: "0-30s", visual: project.title, voiceover: project.video?.hook || "", textOverlay: project.title }];

  const slideHtml = slides
    .map(
      (s, i) => `
    <section class="slide" style="animation-delay:${i * 4}s">
      <div class="scene-time">${s.time || ""}</div>
      <h1>${escapeHtml(s.textOverlay || s.visual || project.title)}</h1>
      <p class="vo">${escapeHtml(s.voiceover || "")}</p>
      <p class="visual">${escapeHtml(s.visual || "")}</p>
    </section>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(project.title)} — Video Preview</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#111;color:#fff}
.slide{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:40px;text-align:center;
  animation:fade 4s ease-in-out infinite;opacity:0}
@keyframes fade{0%,100%{opacity:0}10%,40%{opacity:1}}
h1{font-size:clamp(1.5rem,5vw,2.5rem);max-width:800px}
.vo{font-size:1.1rem;color:#a5b4fc;max-width:640px}
.visual{font-size:.9rem;color:#94a3b8;margin-top:12px}
.scene-time{font-size:.75rem;color:#64748b;margin-bottom:16px}
.bar{position:fixed;bottom:0;left:0;right:0;padding:12px;background:rgba(0,0,0,.8);font-size:12px;text-align:center}
</style></head><body>
${slideHtml}
<div class="bar">Pzhisen AI 推广视频预览 · ${escapeHtml(project.title)} · 录屏即可导出 MP4</div>
</body></html>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function saveVideoPreview(companyId, projectId, html) {
  ensurePreviewDir();
  const dir = path.join(PREVIEW_DIR, companyId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${projectId}.html`);
  fs.writeFileSync(file, html, "utf8");
  return `/video-preview/${companyId}/${projectId}.html`;
}

export function getVideoPreviewPath(companyId, projectId) {
  return path.join(PREVIEW_DIR, companyId, `${projectId}.html`);
}

export function createVideoProject(company, { title, topic, video, platforms, userMessage }) {
  const id = uuidv4();
  const platformIds = (platforms?.length ? platforms : VIDEO_PLATFORM_IDS).filter((p) => MARKETING_PLATFORMS[p]);

  const project = {
    id,
    companyId: company.id,
    title: title || `${company.name} 推广视频`,
    topic: topic || company.idea,
    userMessage,
    video: video || defaultVideo(topic || company.idea, company.name),
    platforms: platformIds.map((pid) => ({
      id: pid,
      name: MARKETING_PLATFORMS[pid].nameZh,
      publishUrl: MARKETING_PLATFORMS[pid].publishUrl,
      copy: buildPlatformCopy(pid, title, topic, company),
      status: "ready",
      publishedAt: null,
    })),
    status: "generated",
    previewUrl: null,
    createdAt: new Date().toISOString(),
  };

  project.previewUrl = saveVideoPreview(company.id, id, buildPreviewHtml(project));

  const data = getProjects(company.id);
  data.projects.unshift(project);
  if (data.projects.length > 20) data.projects = data.projects.slice(0, 20);
  saveProjects(company.id, data);

  return project;
}

function defaultVideo(topic, brand) {
  return {
    duration: "30s",
    format: "9:16 竖屏",
    hook: `3秒抓住注意力：${topic}`,
    scenes: [
      { time: "0-3s", visual: "品牌Logo特写", voiceover: `你知道${brand}吗？`, textOverlay: brand },
      { time: "3-15s", visual: "产品/服务展示", voiceover: topic, textOverlay: "核心卖点" },
      { time: "15-25s", visual: "用户场景", voiceover: "立即体验，零成本了解详情", textOverlay: "了解更多" },
      { time: "25-30s", visual: "CTA画面", voiceover: "点击主页链接，马上开始", textOverlay: "立即行动" },
    ],
    cta: "访问官网 / 关注账号",
  };
}

function buildPlatformCopy(platformId, title, topic, company) {
  const p = MARKETING_PLATFORMS[platformId];
  const tags = `#${company.name.replace(/\s+/g, "")} #推广`;
  if (platformId === "x") {
    return `${title || topic} — ${company.name}\n${topic}\n${tags}`.slice(0, 280);
  }
  if (platformId === "xiaohongshu") {
    return `【${title || topic}】\n\n${topic}\n\n✨ ${company.idea}\n\n${tags}`;
  }
  return `${title || topic}\n\n${topic}\n\n${company.idea}\n\n${tags}`;
}

export function publishVideoProject(companyId, projectId, platformIds = null) {
  const data = getProjects(companyId);
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return null;

  const now = new Date().toISOString();
  const targets = platformIds
    ? project.platforms.filter((p) => platformIds.includes(p.id))
    : project.platforms;

  for (const plat of targets) {
    plat.status = "published";
    plat.publishedAt = now;
    plat.publishNote = `已加入自动发布队列 — 请在上传页粘贴文案并上传视频（${plat.publishUrl || "手动发布"}）`;
  }

  project.status = targets.length === project.platforms.length ? "published" : "partial";
  project.publishedAt = now;
  saveProjects(companyId, data);

  return { project, published: targets };
}

export function listVideoProjects(companyId) {
  return getProjects(companyId).projects;
}

export function getVideoProject(companyId, projectId) {
  return getProjects(companyId).projects.find((p) => p.id === projectId) || null;
}

export function getOrCreateSession(companyId, sessionId) {
  const data = getSessions(companyId);
  const id = sessionId || uuidv4();
  if (!data.sessions[id]) {
    data.sessions[id] = { id, messages: [], createdAt: new Date().toISOString() };
  }
  return { session: data.sessions[id], data, id };
}

export function appendSessionMessage(companyId, sessionId, role, content, meta = {}) {
  const { session, data, id } = getOrCreateSession(companyId, sessionId);
  session.messages.push({ role, content, meta, at: new Date().toISOString() });
  if (session.messages.length > 40) session.messages = session.messages.slice(-40);
  data.sessions[id] = session;
  saveSessions(companyId, data);
  return id;
}

export function buildVideoChatSystemPrompt(company) {
  return `You are Pzhisen Video Marketing Agent — a conversational AI that creates promotion videos and publishes to social platforms.

${ZERO_COST_MARKETING_POLICY}

Company: ${company.name}
Product: ${company.idea}

Supported video platforms: YouTube, TikTok, X, Facebook, 微信视频号, 抖音, 快手, 小红书, 腾讯视频, QQ空间.

When user asks to create/generate a video or publish:
1. Understand topic, duration, style from their message
2. Reply in Chinese, friendly and concise
3. Always include structured video data

Respond with JSON only:
{
  "reply": "给用户的中文回复，说明已生成视频并准备发布",
  "action": "generate" | "publish" | "generate_and_publish" | "chat",
  "title": "视频标题",
  "topic": "推广主题",
  "platforms": ["douyin","kuaishou",...],
  "video": {
    "duration": "30s",
    "format": "9:16",
    "hook": "...",
    "scenes": [{"time":"0-5s","visual":"...","voiceover":"...","textOverlay":"..."}],
    "cta": "..."
  }
}

If user only chats without video request, use action "chat" and omit video/platforms.`;
}

export { detectPlatformsFromText, VIDEO_PLATFORM_IDS as defaultPlatforms };
