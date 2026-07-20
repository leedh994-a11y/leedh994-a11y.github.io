import fs from "fs";

async function refreshXToken(connection) {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret || !connection.refreshToken) {
    throw new Error("X OAuth 未配置或缺少 refresh token");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
    client_id: clientId,
  });
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  }
  const res = await fetch("https://api.twitter.com/2/oauth2/token", { method: "POST", headers, body });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.detail || "X token refresh failed");
  return data.access_token;
}

async function uploadXMedia(accessToken, mp4Path) {
  const videoBytes = fs.readFileSync(mp4Path);
  const form = new FormData();
  form.append("media", new Blob([videoBytes], { type: "video/mp4" }), "video.mp4");
  form.append("media_category", "tweet_video");

  const res = await fetch("https://api.x.com/2/media/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.title || JSON.stringify(data).slice(0, 300));
  return data.data?.id || data.media_id_string;
}

export async function publishToX({ project, platformMeta, connection, mp4Path }) {
  const accessToken = await refreshXToken(connection);
  const mediaId = await uploadXMedia(accessToken, mp4Path);
  const text = (platformMeta.copy || project.title || "").slice(0, 280);

  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, media: { media_ids: [String(mediaId)] } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.title || JSON.stringify(data).slice(0, 300));

  const tweetId = data.data?.id;
  return {
    success: true,
    mode: "oauth",
    message: "已通过 OAuth 自动发布到 X",
    url: tweetId ? `https://x.com/i/web/status/${tweetId}` : "https://x.com/compose/tweet",
    remoteId: tweetId,
  };
}
