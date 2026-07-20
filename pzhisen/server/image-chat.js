/** Validate and normalize chat image attachments (base64 data URLs). */

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image (decoded)

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), base64: match[2] };
}

function base64ByteLength(base64) {
  const padding = (base64.match(/=+$/) || [""])[0].length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function normalizeChatImages(raw) {
  if (!Array.isArray(raw) || !raw.length) return [];

  const images = [];
  for (const item of raw.slice(0, MAX_IMAGES)) {
    const dataUrl = typeof item === "string" ? item : item?.dataUrl;
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) continue;
    if (!ALLOWED_MIME.has(parsed.mime)) continue;
    if (base64ByteLength(parsed.base64) > MAX_BYTES) continue;
    images.push(dataUrl);
  }
  return images;
}

export function buildVisionUserContent(text, images = []) {
  const prompt = text?.trim() || "请分析附件图片，并结合公司业务给出具体建议。";
  if (!images.length) return prompt;

  const parts = [{ type: "text", text: prompt }];
  for (const url of images) {
    parts.push({ type: "image_url", image_url: { url } });
  }
  return parts;
}

export function getVisionModel() {
  return process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o-mini";
}
