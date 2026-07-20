import fs from "fs";

async function refreshGoogleToken(connection) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !connection.refreshToken) {
    throw new Error("YouTube OAuth 未配置或缺少 refresh token");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: connection.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Token refresh failed");
  return data.access_token;
}

export async function publishToYouTube({ project, platformMeta, connection, mp4Path }) {
  const accessToken = await refreshGoogleToken(connection);
  const videoBytes = fs.readFileSync(mp4Path);
  const metadata = {
    snippet: {
      title: (project.title || platformMeta.copy || "Pzhisen 推广视频").slice(0, 100),
      description: (platformMeta.copy || project.topic || "").slice(0, 5000),
      categoryId: "22",
    },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
  };

  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(videoBytes.length),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(err.slice(0, 300));
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube 未返回上传地址");

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(videoBytes.length),
    },
    body: videoBytes,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(err.slice(0, 300));
  }

  const result = await uploadRes.json();
  const videoId = result.id;
  return {
    success: true,
    mode: "oauth",
    message: `已通过 OAuth 自动上传到 YouTube`,
    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
    remoteId: videoId,
  };
}
