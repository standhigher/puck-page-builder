export type TrackingPageUrlOptions = Readonly<{
  allowLocalhost?: boolean;
}>;

function hasControlCharacter(value: string) {
  return [...value].some((character) => character.charCodeAt(0) < 32);
}

function isLocalDevelopmentHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function allowsLocalhostByDefault() {
  return typeof window !== "undefined" && isLocalDevelopmentHost(window.location.hostname);
}

/**
 * Sanitizes merchant-configured URLs before they enter a rendered href or src.
 * Production accepts public HTTPS only. HTTP is limited to an explicitly local
 * development host and relative URLs are never part of the template protocol.
 */
export function safeTrackingPageUrl(value: unknown, options: TrackingPageUrlOptions = {}) {
  if (typeof value !== "string" || !value || value.trim() !== value || hasControlCharacter(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.username || url.password) return undefined;
    if (url.protocol === "https:" && !isLocalDevelopmentHost(url.hostname)) return url.toString();
    if (url.protocol === "http:" && isLocalDevelopmentHost(url.hostname) && (options.allowLocalhost ?? allowsLocalhostByDefault())) return url.toString();
    return undefined;
  } catch {
    return undefined;
  }
}

export function isSafeTrackingPageUrl(value: unknown, options?: TrackingPageUrlOptions) {
  return safeTrackingPageUrl(value, options) !== undefined;
}
