import fs from "fs";
import { getPlatformConnection } from "../oauth-store.js";
import { isPlatformOAuthConfigured } from "../oauth-config.js";
import { publishToYouTube } from "./youtube.js";
import { publishToTikTok } from "./tiktok.js";
import { publishToX } from "./x.js";
import { publishToFacebook } from "./facebook.js";
import { publishManual } from "./manual.js";
import { getVideoMp4Path } from "../video-render.js";

const PUBLISHERS = {
  youtube: publishToYouTube,
  tiktok: publishToTikTok,
  x: publishToX,
  facebook: publishToFacebook,
};

export async function publishToPlatform(companyId, platformId, project, platformMeta) {
  const mp4Path = getVideoMp4Path(companyId, project.id);
  const hasMp4 = fs.existsSync(mp4Path);
  const connection = getPlatformConnection(companyId, platformId);
  const publisher = PUBLISHERS[platformId];

  if (publisher && connection && isPlatformOAuthConfigured(platformId) && hasMp4) {
    try {
      return await publisher({ companyId, project, platformMeta, connection, mp4Path });
    } catch (err) {
      return {
        success: false,
        mode: "oauth",
        message: `${platformMeta.name} OAuth 上传失败：${err.message}`,
        error: err.message,
      };
    }
  }

  return publishManual({ project, platformMeta, hasMp4, oauthConfigured: isPlatformOAuthConfigured(platformId), connected: Boolean(connection) });
}
