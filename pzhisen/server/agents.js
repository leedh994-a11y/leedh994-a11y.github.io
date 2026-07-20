import { chatCompletion, getModels } from "./openrouter.js";
import { normalizeChatImages, buildVisionUserContent, getVisionModel } from "./image-chat.js";
import { deployChatToAgent, getAgentDeployContext } from "./agent-instructions.js";
import { ZERO_COST_MARKETING_POLICY, zeroCostMarketingContext, isPromotionAgent } from "./marketing-policy.js";

export const AGENTS = {
  ceo: {
    id: "ceo",
    name: "CEO Agent",
    icon: "◆",
    modelKey: "ceo",
    system: `You are the CEO Agent at Pzhisen — an AI executive for a solo founder's company.
Your job: assess company state, set daily priorities, allocate work across agents, and write concise strategic briefs.
Be decisive, numbered, and actionable. Max 200 words unless asked for more.
Prioritize zero-cost organic growth — never assign paid ad budgets.`,
  },
  engineering: {
    id: "engineering",
    name: "Engineering Agent",
    icon: "⌘",
    modelKey: "default",
    system: `You are the Engineering Agent at Pzhisen. You ship code, fix bugs, and improve the product.
Output: specific technical tasks, file/feature suggestions, and deployment steps. Be practical for a small team.
When the user deploys reference images via dashboard chat, treat them as design specs: output concrete HTML/CSS/JS or framework code snippets that implement the UI shown in the images.`,
  },
  marketing: {
    id: "marketing",
    name: "Marketing Agent",
    icon: "✦",
    modelKey: "default",
    system: `You are the Marketing Agent at Pzhisen. You promote companies using 100% FREE organic marketing only.
${ZERO_COST_MARKETING_POLICY}
Output: ready-to-use copy snippets, free channel recommendations, SEO titles, social post drafts, and a weekly content calendar — all with $0 / ¥0 spend.
Use deployed reference images as creative direction for organic campaigns.`,
  },
  ads: {
    id: "ads",
    name: "Growth Agent",
    icon: "▶",
    modelKey: "default",
    system: `You are the Growth Agent at Pzhisen (zero-cost promotion — NOT paid ads).
${ZERO_COST_MARKETING_POLICY}
You do NOT run paid Meta/Facebook/Google ad campaigns. Instead: organic social growth, free listings, SEO landing pages, community posts, and referral loops — all $0 spend.
Output: organic post copy, free channel checklist, audience targeting for organic reach, and optimization tips without any budget.`,
  },
  support: {
    id: "support",
    name: "Support Agent",
    icon: "◎",
    modelKey: "default",
    system: `You are the Support Agent at Pzhisen. You handle customer emails and tickets with empathy and speed.
Output: draft replies, FAQ additions, escalation criteria, and satisfaction improvements.`,
  },
  ops: {
    id: "ops",
    name: "Ops Agent",
    icon: "⚡",
    modelKey: "default",
    system: `You are the Ops Agent at Pzhisen. You configure infrastructure: domains, Stripe, email, analytics, GitHub.
Output: checklist of setup steps, tools to use, and verification steps.`,
  },
};

function companyContext(company) {
  return `Company: ${company.name}
Idea: ${company.idea}
Industry: ${company.industry || "General"}
Stage: ${company.stage || "idea"}
Email: ${company.email}`;
}

const TEMPLATE_RESPONSES = {
  ceo: (c) =>
    `[CEO] Daily brief for ${c.name}: (1) Validate core value prop with 5 user interviews. (2) Ship landing page v1. (3) Set weekly KPI: 100 organic site visits. Priority: Engineering + Marketing (zero-cost promotion only).`,
  engineering: (c) =>
    `[Engineering] Sprint plan: scaffold Next.js landing, add waitlist API, deploy to Vercel. SEO meta tags for ${c.name}. ETA: 24h.`,
  marketing: (c) =>
    `[Marketing] Zero-cost promotion live: 1 SEO blog ("How ${c.name} solves X"), 3 organic social threads, 50 free outreach emails to ${c.industry || "target"} leads. Media spend: $0.`,
  ads: (c) =>
    `[Growth] Organic campaign live: 5 free social posts, Google Business Profile updated, 3 directory listings. Headline: "Meet ${c.name}". Spend: $0 — all organic reach.`,
  support: (c) =>
    `[Support] Inbox zero simulated. 12 FAQs drafted from ${c.name} docs. Escalation rule: billing → human within 2h.`,
  ops: (c) =>
    `[Ops] Stack checklist: domain DNS ✓, Stripe test mode, SendGrid sender, Plausible analytics. GitHub repo: ${c.name.toLowerCase().replace(/\s+/g, "-")}.`,
};

function buildAgentSystemPrompt(agent, deployCtx) {
  let system = agent.system;
  if (isPromotionAgent(agent.id)) {
    system += `\n\n${zeroCostMarketingContext()}`;
  }
  if (deployCtx.deployedImageCount > 0 || deployCtx.instructionText) {
    system += `\n\nBackend deployed program instructions are active for this company. You MUST follow all deployed dashboard directives and use the attached reference images when producing code, copy, or plans.`;
  }
  if (agent.id === "engineering" && deployCtx.deployedImageCount > 0) {
    system += `\nFor Engineering: translate deployed images into implementable code (components, styles, assets paths). Include file names and code blocks ready to paste into the repo.`;
  }
  return system;
}

function mergeVisionImages(deployedUrls, chatImages) {
  const seen = new Set();
  const merged = [];
  for (const url of [...deployedUrls, ...chatImages]) {
    const key = url.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(url);
  }
  return merged.slice(0, 10);
}

export async function runAgent(agentId, company, userMessage = null, images = [], options = {}) {
  const agent = AGENTS[agentId];
  if (!agent) throw new Error("Unknown agent");

  const prompt =
    userMessage ||
    `Run your daily work for this company. Summarize what you accomplished today and your top 3 next actions.`;

  let deployMeta = null;
  if (options.deploy !== false && company?.id) {
    deployMeta = deployChatToAgent(company.id, agentId, {
      message: prompt,
      images: normalizeChatImages(images),
      imageNames: options.imageNames || [],
    });
  }

  const deployCtx = company?.id ? getAgentDeployContext(company.id, agentId) : { instructionText: "", imageDataUrls: [], deployedImageCount: 0 };
  const chatImages = normalizeChatImages(images);
  const allImages = mergeVisionImages(deployCtx.imageDataUrls, chatImages);

  const models = getModels();
  const model = allImages.length
    ? getVisionModel()
    : (models[agent.modelKey] || models.default);

  const taskParts = [companyContext(company)];
  if (deployCtx.instructionText) {
    taskParts.push("", deployCtx.instructionText);
  }
  taskParts.push("", `Current task: ${prompt}`);

  const userContent = buildVisionUserContent(taskParts.join("\n"), allImages);
  const systemPrompt = buildAgentSystemPrompt(agent, deployCtx);

  try {
    const { content, ai } = await chatCompletion({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      maxTokens: 1200,
    });

    if (ai && content) {
      return {
        agentId,
        agentName: agent.name,
        content,
        ai: true,
        deployed: deployMeta,
        deployedImageCount: deployCtx.deployedImageCount,
      };
    }
  } catch (err) {
    console.error(`Agent ${agentId} AI error:`, err.message);
  }

  const template = TEMPLATE_RESPONSES[agentId]?.(company) || `[${agent.name}] Task queued for ${company.name}.`;
  const imageNote = allImages.length
    ? ` ${allImages.length} image(s) deployed to agent backend instructions.`
    : "";
  const aiNote = allImages.length
    ? " Image analysis requires OPENROUTER_API_KEY and a vision-capable model."
    : "";
  return {
    agentId,
    agentName: agent.name,
    content: template + imageNote,
    ai: false,
    deployed: deployMeta,
    deployedImageCount: deployCtx.deployedImageCount,
    note: `AI offline — template response.${aiNote} Set OPENROUTER_API_KEY for live agents.`,
  };
}

export async function runDailyStandup(company) {
  const results = [];
  for (const id of Object.keys(AGENTS)) {
    const result = await runAgent(id, company, "Execute your daily autonomous tasks. Be specific and brief.", [], { deploy: false });
    results.push(result);
  }
  return results;
}

export async function runCeoOnboarding(company) {
  return runAgent(
    "ceo",
    company,
    `A new founder just signed up. Analyze their business idea and produce:
1) One-paragraph company vision
2) 7-day launch plan
3) Which agents to activate first and why`,
    [],
    { deploy: false }
  );
}
