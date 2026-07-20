import fs from "fs";

async function getPageAccessToken(userToken) {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const pagesRes = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${encodeURIComponent(userToken)}`
  );
  const pagesData = await pagesRes.json();
  if (!pagesRes.ok) throw new Error(pagesData.error?.message || "无法获取 Facebook 页面列表");

  const page = pagesData.data?.[0];
  if (!page?.access_token) {
    throw new Error("未找到可发布的 Facebook 主页，请确保账号拥有页面管理权限");
  }
  return { pageId: page.id, pageName: page.name, pageToken: page.access_token, appId, appSecret };
}

export async function publishToFacebook({ project, platformMeta, connection, mp4Path }) {
  const { pageId, pageName, pageToken } = await getPageAccessToken(connection.accessToken);
  const videoBytes = fs.readFileSync(mp4Path);
  const form = new FormData();
  form.append("access_token", pageToken);
  form.append("description", (platformMeta.copy || project.topic || "").slice(0, 5000));
  form.append("title", (project.title || "").slice(0, 255));
  form.append("source", new Blob([videoBytes], { type: "video/mp4" }), `${project.id}.mp4`);

  const res = await fetch(`https://graph-video.facebook.com/v18.0/${pageId}/videos`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data).slice(0, 300));

  return {
    success: true,
    mode: "oauth",
    message: `已通过 OAuth 自动上传到 Facebook 主页「${pageName}」`,
    url: data.id ? `https://www.facebook.com/${pageId}/videos/${data.id}` : "https://www.facebook.com/",
    remoteId: data.id,
  };
}
