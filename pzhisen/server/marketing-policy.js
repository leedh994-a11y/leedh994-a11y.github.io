/** Zero-cost organic promotion policy — no paid ad spend for users or platform. */

export const ZERO_COST_MARKETING_POLICY = `
ZERO-COST MARKETING RULES (mandatory):
- Never recommend paid ads, paid boosts, or media budgets (no Meta/Google/TikTok ad spend).
- Never ask the user to recharge, top up, or pay any promotion fees.
- Focus only on free organic channels: SEO, blog content, social organic posts, email outreach, communities, forums, free listings, Google Business Profile, word-of-mouth.
- All promotion plans must show $0 / ¥0 media spend. Revenue comes later from the user's own business, not from promotion costs now.
- Pzhisen platform promotion for the user's site is also zero-cost — no platform fees for marketing execution.
`.trim();

export const ZERO_COST_MARKETING_CHANNELS = [
  "SEO blog articles and landing page optimization",
  "Organic social posts (Twitter/X, LinkedIn, Facebook Page, Instagram organic)",
  "Cold email / newsletter (free tiers)",
  "Community outreach (Reddit, Discord, forums — follow rules)",
  "Google Business Profile and free directory listings",
  "Referral and word-of-mouth campaigns",
  "Free press / HARO-style outreach",
];

export function zeroCostMarketingContext() {
  return `Approved free channels:\n${ZERO_COST_MARKETING_CHANNELS.map((c) => `- ${c}`).join("\n")}`;
}

export function isPromotionAgent(agentId) {
  return agentId === "marketing" || agentId === "ads" || agentId === "ceo";
}
