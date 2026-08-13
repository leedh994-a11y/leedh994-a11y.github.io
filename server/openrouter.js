const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function isAiEnabled() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function getModels() {
  return {
    default: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    advisor: process.env.OPENROUTER_ADVISOR_MODEL || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
  };
}

export async function chatCompletion({ model, messages, maxTokens = 1024, temperature = 0.7 }) {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    return { content: null, ai: false };
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://yoursite.asia",
      "X-Title": process.env.OPENROUTER_SITE_NAME || "Sitp GPT",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error?.message || data?.message || `OpenRouter error ${res.status}`;
    throw new Error(err);
  }

  const content = data.choices?.[0]?.message?.content?.trim() || "";
  return { content, ai: true, model };
}
