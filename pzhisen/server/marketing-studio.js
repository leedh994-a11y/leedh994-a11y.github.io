import { v4 as uuidv4 } from "uuid";
import { loadJson, saveJson, appendLog } from "./store.js";
import { chatCompletion, isAiEnabled } from "./openrouter.js";
import {
  MARKETING_PLATFORMS,
  normalizePlatformIds,
  CONTENT_TYPES,
} from "./platforms.js";
import { ZERO_COST_MARKETING_POLICY } from "./marketing-policy.js";
import { getAgentDeployContext } from "./agent-instructions.js";

function campaignsFile(companyId) {
  return `marketing-campaigns-${companyId}.json`;
}

function getCampaigns(companyId) {
  return loadJson(campaignsFile(companyId), { campaigns: [] });
}

function saveCampaigns(companyId, data) {
  saveJson(campaignsFile(companyId), data);
}

function companyBrief(company) {
  return `Company: ${company.name}
Website/product: ${company.idea}
Industry: ${company.industry || "General"}
Audience: founders and customers in ${company.industry || "general"} market`;
}

function buildGenerationPrompt({ company, topic, platformIds, contentType, language }) {
  const platforms = platformIds.map((id) => {
    const p = MARKETING_PLATFORMS[id];
    return `- ${id}: ${p.nameZh} (${p.name}) — types: ${p.types.join(", ")}`;
  });

  return `You are Pzhisen Auto Marketing Studio. Generate ready-to-publish organic marketing content (ZERO paid ad spend).

${ZERO_COST_MARKETING_POLICY}

${companyBrief(company)}

Campaign topic / product focus: ${topic || company.idea}
Content type requested: ${CONTENT_TYPES[contentType]?.labelZh || contentType}
Output language: ${language === "en" ? "English" : "Chinese (简体中文), with English hashtags where useful"}

Platforms to generate for:
${platforms.join("\n")}

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "summary": "one-line campaign summary",
  "platforms": {
    "<platform_id>": {
      "title": "post/video title if applicable",
      "copy": "main post text / caption / tweet",
      "hashtags": ["tag1", "tag2"],
      "videoScript": {
        "duration": "30s or 60s",
        "format": "vertical 9:16 or horizontal 16:9",
        "hook": "opening 3 seconds",
        "scenes": [{"time": "0-5s", "visual": "...", "voiceover": "...", "textOverlay": "..."}],
        "cta": "call to action"
      },
      "email": {
        "subject": "only for email platform",
        "preheader": "",
        "bodyHtml": "simple HTML email body",
        "bodyText": "plain text version"
      },
      "publishSteps": ["step 1", "step 2"],
      "publishUrl": "platform upload URL if known"
    }
  }
}

Rules:
- For video platforms (youtube, tiktok, douyin, kuaishou, wechat_channels, tencent_video, xiaohongshu): include full videoScript.
- For copy platforms (x, facebook, qq_zone): focus on copy + hashtags; videoScript can be null.
- For email platform: fill email object; copy can be empty.
- xiaohongshu: title + copy in note style with emoji; hashtags at end.
- douyin/kuaishou/wechat_channels: short vertical video scripts, conversational tone.
- All content must be original, engaging, and ready to copy-paste publish.
- Organic only — never mention ad budget.`;
}

function parseAiJson(content) {
  if (!content) return null;
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function templateCampaign({ company, topic, platformIds, contentType }) {
  const t = topic || company.idea;
  const platforms = {};
  for (const id of platformIds) {
    const p = MARKETING_PLATFORMS[id];
    const base = {
      title: `${company.name} — ${t}`.slice(0, 60),
      copy: `【${p.nameZh}】${t}\n\n了解 ${company.name}：${company.idea}\n\n#${company.name.replace(/\s+/g, "")} #推广`,
      hashtags: [company.name.replace(/\s+/g, ""), "创业", "AI"],
      publishSteps: [
        `打开 ${p.nameZh} 发布页面`,
        "粘贴 AI 生成的文案/上传按脚本制作的视频",
        "确认后发布（零成本有机推广）",
      ],
      publishUrl: p.publishUrl,
    };
    if (p.types.includes("video")) {
      base.videoScript = {
        duration: "30s",
        format: "9:16 竖屏",
        hook: `你知道吗？${t}`,
        scenes: [
          { time: "0-5s", visual: "产品/品牌特写", voiceover: `大家好，今天介绍 ${company.name}`, textOverlay: company.name },
          { time: "5-25s", visual: "功能演示或痛点场景", voiceover: t, textOverlay: "立即了解" },
          { time: "25-30s", visual: "Logo + CTA", voiceover: "关注我们，获取更多信息", textOverlay: "点击主页链接" },
        ],
        cta: "访问官网 / 私信咨询",
      };
    }
    if (id === "email") {
      base.email = {
        subject: `${company.name} — ${t}`,
        preheader: "专为您的业务打造",
        bodyText: `您好，\n\n我们是 ${company.name}。${t}\n\n${company.idea}\n\n期待与您合作！`,
        bodyHtml: `<p>您好，</p><p>我们是 <strong>${company.name}</strong>。${t}</p><p>${company.idea}</p>`,
      };
    }
    platforms[id] = base;
  }
  return {
    summary: `零成本推广套餐：${platformIds.length} 个平台`,
    platforms,
    ai: false,
  };
}

export async function generateMarketingCampaign(company, options = {}) {
  const {
    topic = "",
    platforms: platformInput = [],
    contentType = "all",
    language = "zh",
  } = options;

  let platformIds = normalizePlatformIds(platformInput);
  if (contentType === "email") platformIds = platformIds.filter((id) => id === "email" || MARKETING_PLATFORMS[id]?.types.includes("email"));
  if (contentType === "video") platformIds = platformIds.filter((id) => MARKETING_PLATFORMS[id]?.types.includes("video"));
  if (contentType === "copy") platformIds = platformIds.filter((id) => MARKETING_PLATFORMS[id]?.types.includes("copy"));

  const deployCtx = getAgentDeployContext(company.id, "marketing");
  let prompt = buildGenerationPrompt({ company, topic, platformIds, contentType, language });
  if (deployCtx.instructionText) {
    prompt += `\n\nDeployed brand assets from user:\n${deployCtx.instructionText}`;
  }

  let payload = null;
  let ai = false;

  if (isAiEnabled()) {
    try {
      const { content } = await chatCompletion({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You output only valid JSON for multi-platform marketing campaigns. Organic zero-cost promotion only.",
          },
          { role: "user", content: prompt },
        ],
        maxTokens: 4000,
      });
      payload = parseAiJson(content);
      if (payload?.platforms) ai = true;
    } catch (err) {
      console.error("marketing generate error:", err.message);
    }
  }

  if (!payload) {
    payload = templateCampaign({ company, topic, platformIds, contentType });
  }

  // Enrich with platform metadata
  for (const id of Object.keys(payload.platforms || {})) {
    const meta = MARKETING_PLATFORMS[id];
    if (!meta) continue;
    const item = payload.platforms[id];
    item.platformName = meta.nameZh;
    item.publishUrl = item.publishUrl || meta.publishUrl;
    item.hintZh = meta.hintZh;
    item.status = "ready";
  }

  const campaign = {
    id: uuidv4(),
    companyId: company.id,
    topic: topic || company.idea,
    contentType,
    language,
    platformIds: Object.keys(payload.platforms || {}),
    summary: payload.summary,
    platforms: payload.platforms,
    ai,
    zeroCost: true,
    createdAt: new Date().toISOString(),
  };

  const data = getCampaigns(company.id);
  data.campaigns.unshift(campaign);
  if (data.campaigns.length > 30) data.campaigns = data.campaigns.slice(0, 30);
  saveCampaigns(company.id, data);

  appendLog(company.id, {
    agent: "Marketing Studio",
    message: `Generated ${campaign.platformIds.length}-platform campaign: ${campaign.summary}${ai ? "" : " (template)"}`,
    ai,
  });

  return campaign;
}

export function listMarketingCampaigns(companyId, limit = 10) {
  const { campaigns } = getCampaigns(companyId);
  return campaigns.slice(0, limit);
}

export function getMarketingCampaign(companyId, campaignId) {
  const { campaigns } = getCampaigns(companyId);
  return campaigns.find((c) => c.id === campaignId) || null;
}

export function getMarketingStudioConfig() {
  return {
    platforms: Object.values(MARKETING_PLATFORMS),
    contentTypes: Object.values(CONTENT_TYPES),
    zeroCost: true,
  };
}
