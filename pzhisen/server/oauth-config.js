const PUBLIC_URL = (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");

export const OAUTH_PLATFORMS = {
  youtube: {
    id: "youtube",
    nameZh: "YouTube",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
    supportsAutoUpload: true,
  },
  tiktok: {
    id: "tiktok",
    nameZh: "TikTok",
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["video.upload", "user.info.basic"],
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    extraAuthParams: {},
    supportsAutoUpload: true,
  },
  x: {
    id: "x",
    nameZh: "X (推特)",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"],
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
    extraAuthParams: {},
    supportsAutoUpload: true,
    pkce: true,
  },
  facebook: {
    id: "facebook",
    nameZh: "Facebook",
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "publish_video"],
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
    extraAuthParams: {},
    supportsAutoUpload: true,
  },
};

export const MANUAL_UPLOAD_PLATFORMS = [
  "wechat_channels",
  "douyin",
  "kuaishou",
  "xiaohongshu",
  "tencent_video",
  "qq_zone",
];

export function getOAuthRedirectUri(platformId) {
  return `${PUBLIC_URL}/api/oauth/callback/${platformId}`;
}

export function getPlatformOAuthConfig(platformId) {
  return OAUTH_PLATFORMS[platformId] || null;
}

export function isPlatformOAuthConfigured(platformId) {
  const cfg = getPlatformOAuthConfig(platformId);
  if (!cfg) return false;
  return Boolean(process.env[cfg.clientIdEnv] && process.env[cfg.clientSecretEnv]);
}

export function listOAuthPlatforms() {
  return Object.values(OAUTH_PLATFORMS).map((p) => ({
    id: p.id,
    nameZh: p.nameZh,
    configured: isPlatformOAuthConfigured(p.id),
    supportsAutoUpload: p.supportsAutoUpload,
    scopes: p.scopes,
  }));
}
