export function publishManual({ project, platformMeta, hasMp4, oauthConfigured, connected }) {
  const parts = [];
  if (hasMp4) {
    parts.push("MP4 已生成，请下载视频后在平台上传页发布");
  } else {
    parts.push("MP4 正在生成中，请稍后刷新并下载视频");
  }
  if (oauthConfigured && !connected) {
    parts.push(`可在上方连接 ${platformMeta.name} 账号后下次自动上传`);
  } else if (!oauthConfigured) {
    parts.push("该平台暂未配置 OAuth，请手动上传");
  }

  return {
    success: true,
    mode: "manual",
    message: parts.join("；"),
    url: platformMeta.publishUrl || null,
  };
}
