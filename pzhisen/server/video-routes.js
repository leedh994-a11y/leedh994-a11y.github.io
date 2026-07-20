import { chatCompletion, isAiEnabled } from "./openrouter.js";
import { appendLog } from "./store.js";
import {
  createVideoProject,
  publishVideoProject,
  listVideoProjects,
  getVideoProject,
  appendSessionMessage,
  buildVideoChatSystemPrompt,
  detectPlatformsFromText,
  getOrCreateSession,
  VIDEO_PLATFORM_IDS,
} from "./video-studio.js";
import { ensureProjectMp4 } from "./video-render.js";

function parseAiJson(content) {
  if (!content) return null;
  const m = content.trim().match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function templateChatResponse(company, message) {
  const platforms = detectPlatformsFromText(message);
  const wantsVideo = /视频|video|拍摄|脚本|推广|发布|publish/i.test(message);
  const wantsPublish = /发布|publish|上传|post/i.test(message);

  if (!wantsVideo && !wantsPublish) {
    return {
      reply: `你好！我是视频推广智能体。你可以直接说：\n「帮我做一个30秒抖音推广视频，主题是${company.idea}，发布到抖音、快手、小红书」\n我会自动生成视频脚本并加入发布队列。`,
      action: "chat",
    };
  }

  const topic = message.slice(0, 200) || company.idea;
  const p = platforms.length ? platforms : ["douyin", "kuaishou", "xiaohongshu"];
  return {
    reply: `好的！我已为你生成「${topic}」推广视频脚本，并准备发布到 ${p.length} 个平台。请查看下方视频预览与发布状态。`,
    action: wantsPublish ? "generate_and_publish" : "generate",
    title: `${company.name} — 推广视频`,
    topic,
    platforms: p,
    video: null,
  };
}

export async function videoChatHandler(req, res) {
  try {
    const company = req.company;
    const { message, sessionId, autoPublish = true } = req.body || {};
    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: "请输入指令" });
    }

    const sid = appendSessionMessage(company.id, sessionId, "user", message.trim());

    let parsed = null;
    if (isAiEnabled()) {
      const { session } = getOrCreateSession(company.id, sid);
      const history = session.messages.slice(-8).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.role === "user" ? m.content : m.content,
      }));

      try {
        const { content } = await chatCompletion({
          model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
          messages: [
            { role: "system", content: buildVideoChatSystemPrompt(company) },
            ...history,
            { role: "user", content: message.trim() },
          ],
          maxTokens: 2500,
        });
        parsed = parseAiJson(content);
      } catch (err) {
        console.error("video chat AI:", err.message);
      }
    }

    if (!parsed) parsed = templateChatResponse(company, message);

    let project = null;
    let publishResult = null;

    if (parsed.action === "generate" || parsed.action === "generate_and_publish" || parsed.action === "publish") {
      const platforms =
        parsed.platforms?.length ? parsed.platforms : detectPlatformsFromText(message);
      const ids = platforms.length ? platforms : VIDEO_PLATFORM_IDS;

      project = createVideoProject(company, {
        title: parsed.title,
        topic: parsed.topic || message,
        video: parsed.video,
        platforms: ids,
        userMessage: message,
      });

      if (autoPublish && (parsed.action === "generate_and_publish" || parsed.action === "publish" || /发布|publish/i.test(message))) {
        publishResult = await publishVideoProject(company.id, project.id);
        project = publishResult.project;
      }

      appendLog(company.id, {
        agent: "Video Agent",
        message: `Video created: ${project.title} → ${project.platforms.length} platforms${publishResult ? " (publish queued)" : ""}`,
        ai: isAiEnabled(),
      });
    }

    const reply = parsed.reply || "已完成处理。";
    appendSessionMessage(company.id, sid, "assistant", reply, { projectId: project?.id });

    res.json({
      success: true,
      sessionId: sid,
      reply,
      project,
      published: Boolean(publishResult),
      publishTargets: publishResult?.published || [],
      ai: isAiEnabled(),
    });
  } catch (err) {
    console.error("video chat:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export function videoProjectsListHandler(req, res) {
  res.json({ success: true, projects: listVideoProjects(req.company.id) });
}

export function videoProjectGetHandler(req, res) {
  const project = getVideoProject(req.company.id, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, project });
}

export async function videoPublishHandler(req, res) {
  try {
    const { platformIds } = req.body || {};
    const result = await publishVideoProject(req.company.id, req.params.projectId, platformIds);
    if (!result) return res.status(404).json({ success: false, error: "Project not found" });
    appendLog(req.company.id, {
      agent: "Video Agent",
      message: `Published video to ${result.published.length} platform(s)`,
      ai: true,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("video publish:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function videoRenderHandler(req, res) {
  try {
    const project = getVideoProject(req.company.id, req.params.projectId);
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    const updated = await ensureProjectMp4(req.company.id, req.params.projectId);
    res.json({ success: true, project: updated });
  } catch (err) {
    console.error("video render:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
