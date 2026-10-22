/**
 * Turns the raw User-Agent string StreetBiz-BE stores per session
 * (`UserSessions.device_info`, sent verbatim by the client on login) into a
 * short, readable label for the Sessions screen (AUTH-08).
 *
 * This is a small heuristic, not a full UA parser: good enough to tell devices
 * apart in a list, not to branch app behaviour on. Order matters — some engines
 * (Edge, Opera, Samsung Internet) also contain "Chrome" in their UA string, so
 * they must be checked first.
 */
function detectBrowser(ua: string): string | undefined {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/chrome\//i.test(ua)) return 'Chrome';
  // Safari's UA also contains "Version/"; Chrome-based browsers don't.
  if (/safari\//i.test(ua) && /version\//i.test(ua)) return 'Safari';
  return undefined;
}

function detectPlatform(ua: string): string | undefined {
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return 'Android';
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return undefined;
}

/** e.g. "Chrome trên Windows", "Safari trên iPhone", or a fallback for an empty/unknown value. */
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent?.trim()) return 'Thiết bị không xác định';

  const browser = detectBrowser(userAgent);
  const platform = detectPlatform(userAgent);

  if (browser && platform) return `${browser} trên ${platform}`;
  if (browser) return browser;
  if (platform) return platform;
  return 'Thiết bị không xác định';
}
