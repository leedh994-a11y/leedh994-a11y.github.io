/** Social & email platforms supported by the marketing studio. */

export const MARKETING_PLATFORMS = {
  youtube: {
    id: "youtube",
    name: "YouTube",
    nameZh: "YouTube",
    region: "global",
    types: ["video", "copy"],
    publishUrl: "https://studio.youtube.com/channel/upload",
    hintZh: "复制标题、描述、标签后，在 YouTube Studio 上传视频并粘贴",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    nameZh: "TikTok",
    region: "global",
    types: ["video", "copy"],
    publishUrl: "https://www.tiktok.com/upload",
    hintZh: "按脚本拍摄/剪辑后，在 TikTok 上传并粘贴文案",
  },
  x: {
    id: "x",
    name: "X (Twitter)",
    nameZh: "X (推特)",
    region: "global",
    types: ["copy"],
    publishUrl: "https://x.com/compose/tweet",
    hintZh: "复制推文后，在 X 发帖",
    maxChars: 280,
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    nameZh: "Facebook",
    region: "global",
    types: ["copy", "video"],
    publishUrl: "https://www.facebook.com/",
    hintZh: "复制文案后，在 Facebook 主页发帖",
  },
  wechat_channels: {
    id: "wechat_channels",
    name: "WeChat Channels",
    nameZh: "微信视频号",
    region: "cn",
    types: ["video", "copy"],
    publishUrl: "https://channels.weixin.qq.com/",
    hintZh: "按脚本制作竖屏视频，在微信视频号助手发布",
  },
  douyin: {
    id: "douyin",
    name: "Douyin",
    nameZh: "抖音",
    region: "cn",
    types: ["video", "copy"],
    publishUrl: "https://creator.douyin.com/",
    hintZh: "按脚本拍摄后，在抖音创作者中心发布",
  },
  kuaishou: {
    id: "kuaishou",
    name: "Kuaishou",
    nameZh: "快手",
    region: "cn",
    types: ["video", "copy"],
    publishUrl: "https://cp.kuaishou.com/",
    hintZh: "按脚本制作短视频，在快手创作者平台发布",
  },
  xiaohongshu: {
    id: "xiaohongshu",
    name: "Xiaohongshu",
    nameZh: "小红书",
    region: "cn",
    types: ["copy", "video"],
    publishUrl: "https://creator.xiaohongshu.com/",
    hintZh: "复制笔记标题+正文+标签，在小红书创作者中心发布",
  },
  tencent_video: {
    id: "tencent_video",
    name: "Tencent Video",
    nameZh: "腾讯视频",
    region: "cn",
    types: ["video", "copy"],
    publishUrl: "https://v.qq.com/",
    hintZh: "按长视频脚本制作后，在腾讯视频上传",
  },
  qq_zone: {
    id: "qq_zone",
    name: "QQ",
    nameZh: "QQ 空间",
    region: "cn",
    types: ["copy"],
    publishUrl: "https://qzone.qq.com/",
    hintZh: "复制说说/日志文案，在 QQ 空间发布",
  },
  email: {
    id: "email",
    name: "Email",
    nameZh: "邮件营销",
    region: "global",
    types: ["email"],
    publishUrl: null,
    hintZh: "复制邮件主题与正文，通过 Gmail/Outlook/QQ邮箱/163邮箱等发送",
    providers: ["Gmail", "Outlook", "Yahoo", "QQ邮箱", "163邮箱", "126邮箱", "iCloud", "ProtonMail"],
  },
};

export const ALL_PLATFORM_IDS = Object.keys(MARKETING_PLATFORMS);

export const CONTENT_TYPES = {
  all: { id: "all", labelZh: "全平台套餐（文案+视频脚本+邮件）", labelEn: "Full package" },
  copy: { id: "copy", labelZh: "推广文案 / 推文", labelEn: "Posts & copy" },
  video: { id: "video", labelZh: "推广视频脚本", labelEn: "Video scripts" },
  email: { id: "email", labelZh: "邮件营销文案", labelEn: "Email campaign" },
};

export function listPlatforms(filter = {}) {
  let items = Object.values(MARKETING_PLATFORMS);
  if (filter.region) items = items.filter((p) => p.region === filter.region || p.region === "global");
  if (filter.contentType && filter.contentType !== "all") {
    items = items.filter((p) => p.types.includes(filter.contentType));
  }
  return items;
}

export function normalizePlatformIds(ids) {
  if (!Array.isArray(ids) || !ids.length) return [...ALL_PLATFORM_IDS];
  return ids.filter((id) => MARKETING_PLATFORMS[id]);
}
