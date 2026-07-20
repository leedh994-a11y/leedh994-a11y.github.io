import fs from "fs";

async function refreshTikTokToken(connection) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret || !connection.refreshToken) {
    throw new Error("TikTok OAuth 未配置或缺少 refresh token");
  }
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
  });
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.message || "TikTok token refresh failed");
  return data.access_token;
}

export async function publishToTikTok({ project, platformMeta, connection, mp4Path }) {
  const accessToken = await refreshTikTokToken(connection);
  const videoBytes = fs.readFileSync(mp4Path);
  const form = new FormData();
  form.append("video", new Blob([videoBytes], { type: "video/mp4" }), `${project.id}.mp4`);

  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: (platformMeta.copy || project.title || "").slice(0, 2200),
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: { source: "FILE_UPLOAD", video_size: videoBytes.length, chunk_size: videoBytes.length, total_chunk_count: 1 },
    }),
  });

  const initData = await initRes.json();
  if (!initRes.ok) {
    throw new Error(initData.error?.message || JSON.stringify(initData).slice(0, 300));
  }

  const publishId = initData.data?.publish_id;
  return {
    success: true,
    mode: "oauth",
    message: `TikTok 视频已提交到发布收件箱（publish_id: ${publishId || "pending"}）`,
    url: "https://www.tiktok.com/upload",
    remoteId: publishId,
  };
}
