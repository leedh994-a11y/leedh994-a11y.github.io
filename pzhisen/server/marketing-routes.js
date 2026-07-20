import {
  generateMarketingCampaign,
  listMarketingCampaigns,
  getMarketingCampaign,
  getMarketingStudioConfig,
} from "./marketing-studio.js";

export function marketingConfigHandler(_req, res) {
  res.json({ success: true, ...getMarketingStudioConfig() });
}

export async function marketingGenerateHandler(req, res) {
  try {
    const company = req.company;
    const { topic, platforms, contentType, language } = req.body || {};
    const campaign = await generateMarketingCampaign(company, {
      topic,
      platforms,
      contentType: contentType || "all",
      language: language || "zh",
    });
    res.json({ success: true, campaign });
  } catch (err) {
    console.error("marketing generate:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export function marketingListHandler(req, res) {
  const campaigns = listMarketingCampaigns(req.company.id, 15);
  res.json({ success: true, campaigns });
}

export function marketingGetHandler(req, res) {
  const campaign = getMarketingCampaign(req.company.id, req.params.campaignId);
  if (!campaign) return res.status(404).json({ success: false, error: "Campaign not found" });
  res.json({ success: true, campaign });
}
