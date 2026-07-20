import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { loadJson, saveJson } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const EXPORT_DIR = path.join(DATA_DIR, "video-exports");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FONT_CANDIDATES = [
  process.env.VIDEO_FONT_PATH,
  "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
  "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
  "/usr/share/fonts/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
].filter(Boolean);

let cachedFont = null;

function resolveFont() {
  if (cachedFont) return cachedFont;
  for (const font of FONT_CANDIDATES) {
    if (fs.existsSync(font)) {
      cachedFont = font;
      return font;
    }
  }
  return null;
}

export function isFfmpegAvailable() {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG, ["-version"], { stdio: "ignore" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-500) || `ffmpeg exited ${code}`));
    });
  });
}

function parseSceneDuration(timeStr, fallback = 5) {
  if (!timeStr) return fallback;
  const range = String(timeStr).match(/(\d+)\s*-\s*(\d+)/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (end > start) return Math.min(20, end - start);
  }
  const single = String(timeStr).match(/(\d+)\s*s/i);
  if (single) return Math.min(20, Number(single[1]));
  return fallback;
}

function escapeDrawtextPath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function buildSceneFilter(titleFile, voFile, visualFile, font) {
  const fontfile = escapeDrawtextPath(font);
  const title = escapeDrawtextPath(titleFile);
  const vo = escapeDrawtextPath(voFile);
  const visual = escapeDrawtextPath(visualFile);
  return [
    `drawtext=fontfile='${fontfile}':textfile='${title}':fontsize=56:fontcolor=white:x=(w-text_w)/2:y=h*0.28:line_spacing=8`,
    `drawtext=fontfile='${fontfile}':textfile='${vo}':fontsize=34:fontcolor=0xA5B4FC:x=(w-text_w)/2:y=h*0.48:line_spacing=6`,
    `drawtext=fontfile='${fontfile}':textfile='${visual}':fontsize=28:fontcolor=0x94A3B8:x=(w-text_w)/2:y=h*0.68:line_spacing=4`,
  ].join(",");
}

function writeTextFile(filePath, text) {
  const value = String(text || "").trim() || " ";
  fs.writeFileSync(filePath, value.slice(0, 500), "utf8");
}

function projectsFile(companyId) {
  return `video-projects-${companyId}.json`;
}

function getProjects(companyId) {
  return loadJson(projectsFile(companyId), { projects: [] });
}

function saveProjects(companyId, data) {
  saveJson(projectsFile(companyId), data);
}

function getVideoProject(companyId, projectId) {
  return getProjects(companyId).projects.find((p) => p.id === projectId) || null;
}

function updateVideoProject(companyId, projectId, patch) {
  const data = getProjects(companyId);
  const idx = data.projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return null;
  data.projects[idx] = { ...data.projects[idx], ...patch, updatedAt: new Date().toISOString() };
  saveProjects(companyId, data);
  return data.projects[idx];
}
export function getVideoMp4Path(companyId, projectId) {
  return path.join(EXPORT_DIR, companyId, `${projectId}.mp4`);
}

export async function renderProjectMp4(companyId, project) {
  const font = resolveFont();
  if (!font) {
    throw new Error("未找到中文字体，无法渲染 MP4。请在服务器安装 ffmpeg 与 Noto/WenQuanYi 字体。");
  }

  const available = await isFfmpegAvailable();
  if (!available) {
    throw new Error("服务器未安装 ffmpeg，无法生成 MP4。");
  }

  updateVideoProject(companyId, project.id, { mp4Status: "rendering", mp4Error: null });

  const scenes = project.video?.scenes?.length
    ? project.video.scenes
    : [{ time: "0-5s", visual: project.title, voiceover: project.video?.hook || "", textOverlay: project.title }];

  const width = 1080;
  const height = 1920;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pzhisen-vid-"));
  const segmentFiles = [];

  try {
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const duration = parseSceneDuration(scene.time, 5);
      const titleFile = path.join(tmpDir, `title-${i}.txt`);
      const voFile = path.join(tmpDir, `vo-${i}.txt`);
      const visualFile = path.join(tmpDir, `visual-${i}.txt`);
      writeTextFile(titleFile, scene.textOverlay || scene.visual || project.title);
      writeTextFile(voFile, scene.voiceover || project.video?.hook || "");
      writeTextFile(visualFile, scene.visual || project.topic || "");

      const segPath = path.join(tmpDir, `seg-${i}.mp4`);
      const filter = buildSceneFilter(titleFile, voFile, visualFile, font);
      await runFfmpeg([
        "-f",
        "lavfi",
        "-i",
        `color=c=0x1e1b4b:s=${width}x${height}:d=${duration}:r=30`,
        "-vf",
        filter,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-y",
        segPath,
      ]);
      segmentFiles.push(segPath);
    }

    const listFile = path.join(tmpDir, "concat.txt");
    fs.writeFileSync(listFile, segmentFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));

    const outDir = path.join(EXPORT_DIR, companyId);
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${project.id}.mp4`);
    await runFfmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", "-movflags", "+faststart", "-y", outPath]);

    const mp4Url = `/video-file/${companyId}/${project.id}.mp4`;
    updateVideoProject(companyId, project.id, {
      mp4Status: "ready",
      mp4Url,
      mp4Error: null,
      mp4RenderedAt: new Date().toISOString(),
    });
    return { mp4Url, mp4Path: outPath };
  } catch (err) {
    updateVideoProject(companyId, project.id, {
      mp4Status: "failed",
      mp4Error: err.message,
    });
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function ensureProjectMp4(companyId, projectId) {
  const project = getVideoProject(companyId, projectId);
  if (!project) return null;
  if (project.mp4Status === "ready" && project.mp4Url) return project;
  if (project.mp4Status === "rendering") return project;
  await renderProjectMp4(companyId, project);
  return getVideoProject(companyId, projectId);
}

export function queueProjectMp4Render(companyId, project) {
  updateVideoProject(companyId, project.id, { mp4Status: "pending", mp4Url: null, mp4Error: null });
  setImmediate(() => {
    renderProjectMp4(companyId, project).catch((err) => {
      console.error("MP4 render failed:", err.message);
    });
  });
}
