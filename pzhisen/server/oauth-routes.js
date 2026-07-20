import {
  getPlatformOAuthConfig,
  getOAuthRedirectUri,
  isPlatformOAuthConfigured,
  listOAuthPlatforms,
  OAUTH_PLATFORMS,
} from "./oauth-config.js";
import {
  consumeOAuthPending,
  createOAuthState,
  createPkcePair,
  getPlatformConnection,
  listPlatformConnections,
  removePlatformConnection,
  saveOAuthPending,
  savePlatformConnection,
} from "./oauth-store.js";

const PUBLIC_URL = (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");

function dashboardRedirect(companyId, params = {}) {
  const q = new URLSearchParams({ company: companyId, ...params });
  return `${PUBLIC_URL}/dashboard.html?${q}`;
}

export function oauthStatusHandler(req, res) {
  const connections = listPlatformConnections(req.company.id).map((c) => ({
    ...c,
    configured: isPlatformOAuthConfigured(c.platformId),
  }));
  res.json({
    success: true,
    platforms: listOAuthPlatforms(),
    connections,
  });
}

export function oauthConnectHandler(req, res) {
  const platformId = req.params.platform;
  const cfg = getPlatformOAuthConfig(platformId);
  if (!cfg) return res.status(400).json({ success: false, error: "不支持的平台" });
  if (!isPlatformOAuthConfigured(platformId)) {
    return res.status(503).json({
      success: false,
      error: `${cfg.nameZh} OAuth 尚未在服务器配置`,
      errorZh: `管理员需在 Render 环境变量中配置 ${cfg.clientIdEnv} 与 ${cfg.clientSecretEnv}`,
    });
  }

  const state = createOAuthState();
  const pkce = cfg.pkce ? createPkcePair() : null;
  saveOAuthPending(state, {
    companyId: req.company.id,
    userId: req.user.id,
    platformId,
    codeVerifier: pkce?.verifier || null,
  });

  const params = new URLSearchParams({
    client_id: process.env[cfg.clientIdEnv],
    redirect_uri: getOAuthRedirectUri(platformId),
    response_type: "code",
    scope: cfg.scopes.join(" "),
    state,
    ...(cfg.extraAuthParams || {}),
  });

  if (pkce) {
    params.set("code_challenge", pkce.challenge);
    params.set("code_challenge_method", "S256");
  }

  res.json({ success: true, authUrl: `${cfg.authUrl}?${params}` });
}

export async function oauthCallbackHandler(req, res) {
  const platformId = req.params.platform;
  const { code, state, error, error_description: errorDescription } = req.query;
  const cfg = getPlatformOAuthConfig(platformId);

  if (!cfg) return res.status(400).send("Unknown platform");
  if (error) {
    return res.redirect(dashboardRedirect("", { oauth: "error", msg: errorDescription || error }));
  }

  const pending = consumeOAuthPending(state);
  if (!pending || pending.platformId !== platformId) {
    return res.redirect(dashboardRedirect(pending?.companyId || "", { oauth: "error", msg: "invalid_state" }));
  }

  try {
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getOAuthRedirectUri(platformId),
      client_id: process.env[cfg.clientIdEnv],
      client_secret: process.env[cfg.clientSecretEnv],
    });
    if (pending.codeVerifier) tokenBody.set("code_verifier", pending.codeVerifier);

    const tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || tokenData.error?.message || "Token exchange failed");
    }

    const accountName = await fetchAccountName(platformId, tokenData.access_token);
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    savePlatformConnection(pending.companyId, platformId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresAt,
      accountName,
      scope: tokenData.scope || cfg.scopes.join(" "),
      tokenType: tokenData.token_type || "Bearer",
    });

    res.redirect(dashboardRedirect(pending.companyId, { oauth: "connected", platform: platformId }));
  } catch (err) {
    console.error("OAuth callback:", err.message);
    res.redirect(dashboardRedirect(pending.companyId, { oauth: "error", msg: err.message }));
  }
}

async function fetchAccountName(platformId, accessToken) {
  try {
    if (platformId === "youtube") {
      const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      return data.items?.[0]?.snippet?.title || "YouTube";
    }
    if (platformId === "x") {
      const res = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      return data.data?.username ? `@${data.data.username}` : "X";
    }
    if (platformId === "facebook") {
      const res = await fetch(`https://graph.facebook.com/v18.0/me?fields=name&access_token=${accessToken}`);
      const data = await res.json();
      return data.name || "Facebook";
    }
    if (platformId === "tiktok") {
      const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      return data.data?.user?.display_name || "TikTok";
    }
  } catch {
    return OAUTH_PLATFORMS[platformId]?.nameZh || platformId;
  }
  return platformId;
}

export function oauthDisconnectHandler(req, res) {
  const platformId = req.params.platform;
  if (!getPlatformOAuthConfig(platformId)) {
    return res.status(400).json({ success: false, error: "不支持的平台" });
  }
  removePlatformConnection(req.company.id, platformId);
  res.json({ success: true });
}
