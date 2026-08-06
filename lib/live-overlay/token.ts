const OVERLAY_TOKEN_ENV_KEY = "LIVE_OVERLAY_TOKEN";

export const getLiveOverlayToken = () => {
  const token = process.env[OVERLAY_TOKEN_ENV_KEY]?.trim();
  return token && token.length > 0 ? token : null;
};

export const isLiveOverlayTokenValid = (token?: string | null) => {
  const configuredToken = getLiveOverlayToken();
  if (!configuredToken || !token) return false;
  return token.trim() === configuredToken;
};

export const getLiveOverlayTokenEnvKey = () => OVERLAY_TOKEN_ENV_KEY;
