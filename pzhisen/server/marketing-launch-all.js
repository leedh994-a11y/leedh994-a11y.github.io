import { loadJson, saveJson } from "./store.js";
import { ZERO_COST_MARKETING_CHANNELS } from "./marketing-policy.js";
import { MARKETING_PLATFORMS } from "./platforms.js";
import { bumpMarketingActivity, getMarketingDashboard } from "./marketing-dashboard.js";
import {
  bumpContentMarketingActivity,
  getContentMarketingDashboard,
} from "./content-marketing-dashboard.js";
import { runAgent } from "./agents.js";

const STORE = "marketing-launch-log.json";

/** Every zero-cost promotion method across all dashboards. */
export const ALL_MARKETING_METHODS = [
  { id: "seo_articles", category: "内容营销自动化", label: "SEO 文章自动生成与发布" },
  { id: "blog", category: "内容营销自动化", label: "博客内容创作与更新" },
  { id: "landing_pages", category: "内容营销自动化", label: "落地页优化与发布" },
  { id: "social_posts", category: "内容营销自动化", label: "社交媒体帖子自动生成发布" },
  { id: "meta_seo", category: "内容营销自动化", label: "Meta 标签与结构化 SEO" },
  { id: "free_seo", category: "免费渠道触达", label: "免费 SEO 站内优化" },
  { id: "organic_social", category: "免费渠道触达", label: "有机社交媒体营销（零广告费）" },
  { id: "google_business", category: "免费渠道触达", label: "Google Business 资料优化" },
  { id: "free_directories", category: "免费渠道触达", label: "免费商业目录网站提交" },
  { id: "zero_spend", category: "免费渠道触达", label: "零媒体花费 $0/¥0 合规执行" },
  { id: "cold_email", category: "自动化外联与增长", label: "冷邮件 (Cold Email) 外联" },
  { id: "directory_submit", category: "自动化外联与增长", label: "商业目录批量提交" },
  { id: "community", category: "自动化外联与增长", label: "Reddit / 论坛 / Discord 社区推广" },
  { id: "haro", category: "自动化外联与增长", label: "HARO 免费公关外联" },
  { id: "referral", category: "自动化外联与增长", label: "口碑推荐与裂变活动" },
  ...Object.values(MARKETING_PLATFORMS).map((p) => ({
    id: `platform_${p.id}`,
    category: "全平台推广",
    label: `${p.nameZh || p.name} 有机推广`,
  })),
  ...ZERO_COST_MARKETING_CHANNELS.map((c, i) => ({
    id: `channel_${i}`,
    category: "免费渠道",
    label: c,
  })),
];

const LAUNCH_AGENTS = ["ceo", "marketing", "ads"];

const LAUNCH_PROMPT = (websiteUrl) => `一键启动全渠道零成本推广。请立即为该公司部署并执行以下全部方式（禁止任何付费广告）：
目标推广网站：${websiteUrl}
1) 内容营销自动化：SEO 文章、博客、落地页、社媒帖子（全部围绕上述网站）
2) 免费渠道：SEO、有机社媒、Google Business、免费目录
3) 自动化外联：冷邮件、目录提交、社区推广、HARO、口碑推荐
4) 全平台：小红书、抖音、X、YouTube、微信视频号等有机发帖
所有推广内容、外链与 CTA 必须指向：${websiteUrl}
输出今日已启动的渠道清单、执行步骤与预计完成天数。`;

function loadLog() {
  return loadJson(STORE, { launches: [] });
}

function saveLog(data) {
  saveJson(STORE, data);
}

function recordLaunch(companyId, summary) {
  const data = loadLog();
  data.launches.push({
    companyId,
    at: new Date().toISOString(),
    methodsCount: ALL_MARKETING_METHODS.length,
    ...summary,
  });
  data.launches = data.launches.slice(-200);
  saveLog(data);
}

function kickstartDashboards(companyId, company) {
  for (const agentId of LAUNCH_AGENTS) {
    for (let i = 0; i < 6; i++) {
      bumpMarketingActivity(companyId, company, { agentId });
      bumpContentMarketingActivity(companyId, company, { agentId });
    }
  }
}

export async function launchAllMarketing(companyId, company, { runAiAgents = true, websiteUrl = null } = {}) {
  const startedAt = new Date().toISOString();
  const targetUrl = websiteUrl || company.websiteUrl || null;
  kickstartDashboards(companyId, company);

  const agentResults = [];
  if (runAiAgents) {
    const prompt = targetUrl ? LAUNCH_PROMPT(targetUrl) : LAUNCH_PROMPT(company.websiteUrl || "（未提供网站 URL）");
    for (const agentId of LAUNCH_AGENTS) {
      try {
        const result = await runAgent(agentId, company, prompt, [], { deploy: true });
        agentResults.push(result);
      } catch (err) {
        agentResults.push({
          agentId,
          agentName: agentId,
          content: `启动 ${agentId} 时出错: ${err.message}`,
          ai: false,
        });
      }
    }
  }

  const marketing = getMarketingDashboard(companyId, company);
  const contentMarketing = getContentMarketingDashboard(companyId, company);

  const summary = {
    startedAt,
    websiteUrl: targetUrl,
    methods: ALL_MARKETING_METHODS,
    methodsTotal: ALL_MARKETING_METHODS.length,
    categories: [...new Set(ALL_MARKETING_METHODS.map((m) => m.category))],
    agentsLaunched: LAUNCH_AGENTS,
    agentResults: agentResults.map((r) => ({
      agentId: r.agentId,
      agentName: r.agentName,
      ai: r.ai,
      preview: (r.content || "").slice(0, 200),
      etaDays: r.etaDays || null,
    })),
    marketingProgress: marketing.campaign?.overallProgress,
    contentMarketingProgress: contentMarketing.campaign?.overallProgress,
    zeroCostPledge: "$0 / ¥0 媒体花费 — 全部为零成本有机推广",
  };

  recordLaunch(companyId, summary);

  return {
    success: true,
    launch: summary,
    marketing,
    contentMarketing,
  };
}

export function getLaunchMethodsCatalog() {
  return {
    total: ALL_MARKETING_METHODS.length,
    methods: ALL_MARKETING_METHODS,
    zeroCostPledge: "所有推广方式均为零成本有机渠道，不购买任何广告",
  };
}
