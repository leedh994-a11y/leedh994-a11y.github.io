import { chatCompletion, getModels } from "./openrouter.js";
import { normalizeChatImages, buildVisionUserContent, getVisionModel } from "./image-chat.js";

export const AGENTS = {
  ceo: {
    id: "ceo",
    name: "CEO Agent",
    icon: "◆",
    modelKey: "ceo",
    system: `You are the CEO Agent at Pzhisen — an AI executive for a solo founder's company.
Your job: assess company state, set daily priorities, allocate work across agents, and write concise strategic briefs.
Be decisive, numbered, and actionable. Max 200 words unless asked for more.`,
  },
  engineering: {
    id: "engineering",
    name: "Engineering Agent",
    icon: "⌘",
    modelKey: "default",
    system: `You are the Engineering Agent at Pzhisen. You ship code, fix bugs, and improve the product.
Output: specific technical tasks, file/feature suggestions, and deployment steps. Be practical for a small team.`,
  },
  marketing: {
    id: "marketing",
    name: "Marketing Agent",
    icon: "✦",
    modelKey: "default",
    system: `You are the Marketing Agent at Pzhisen. You create SEO content, social posts, cold emails, and outreach.
Output: ready-to-use copy snippets, channel recommendations, and a weekly content calendar outline.`,
  },
  ads: {
    id: "ads",
    name: "Ads Agent",
    icon: "▶",
    modelKey: "default",
    system: `You are the Ads Agent at Pzhisen. You run Meta/Facebook/Instagram ad campaigns.
Output: ad angles, headline/body copy, audience targeting, daily budget split, and optimization rules.`,
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
    `[CEO] Daily brief for ${c.name}: (1) Validate core value prop with 5 user interviews. (2) Ship landing page v1. (3) Set weekly KPI: 100 site visits. Priority agents: Engineering + Marketing.`,
  engineering: (c) =>
    `[Engineering] Sprint plan: scaffold Next.js landing, add waitlist API, deploy to Vercel. Fix: add meta tags for ${c.name}. ETA: 24h.`,
  marketing: (c) =>
    `[Marketing] Published: 1 SEO blog ("How ${c.name} solves X"), 3 Twitter threads, 50 cold emails to ${c.industry || "target"} leads.`,
  ads: (c) =>
    `[Ads] Meta campaign draft: $15/day, interest targeting. Headline: "Meet ${c.name}". ROAS target 2×. Awaiting approval to launch.`,
  support: (c) =>
    `[Support] Inbox zero simulated. 12 FAQs drafted from ${c.name} docs. Escalation rule: billing → human within 2h.`,
  ops: (c) =>
    `[Ops] Stack checklist: domain DNS ✓, Stripe test mode, SendGrid sender, Plausible analytics. GitHub repo: ${c.name.toLowerCase().replace(/\s+/g, "-")}.`,
};

export async function runAgent(agentId, company, userMessage = null, images = []) {
  const agent = AGENTS[agentId];
  if (!agent) throw new Error("Unknown agent");

  const prompt =
    userMessage ||
    `Run your daily work for this company. Summarize what you accomplished today and your top 3 next actions.`;

  const chatImages = normalizeChatImages(images);
  const models = getModels();
  const model = chatImages.length
    ? getVisionModel()
    : (models[agent.modelKey] || models.default);

  const userContent = buildVisionUserContent(
    `${companyContext(company)}\n\nTask: ${prompt}`,
    chatImages
  );

  try {
    const { content, ai } = await chatCompletion({
      model,
      messages: [
        { role: "system", content: agent.system },
        { role: "user", content: userContent },
      ],
      maxTokens: 800,
    });

    if (ai && content) {
      return { agentId, agentName: agent.name, content, ai: true };
    }
  } catch (err) {
    console.error(`Agent ${agentId} AI error:`, err.message);
  }

  const template = TEMPLATE_RESPONSES[agentId]?.(company) || `[${agent.name}] Task queued for ${company.name}.`;
  const imageNote = chatImages.length
    ? " Image analysis requires OPENROUTER_API_KEY and a vision-capable model."
    : "";
  return { agentId, agentName: agent.name, content: template, ai: false, note: `AI offline — template response.${imageNote} Set OPENROUTER_API_KEY for live agents.` };
}

export async function runDailyStandup(company) {
  const results = [];
  for (const id of Object.keys(AGENTS)) {
    const result = await runAgent(id, company, "Execute your daily autonomous tasks. Be specific and brief.");
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
3) Which agents to activate first and why`
  );
}
