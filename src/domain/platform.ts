export type Platform = "ios" | "android" | "other";

export function detectPlatform(ua: string, maxTouchPoints: number): Platform {
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  // iPadOS 13+ reports itself as a Mac; only touch distinguishes it.
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return "ios";
  return "other";
}

/**
 * Browsers built into messaging and social apps (Instagram, Messenger, Facebook, TikTok, Snapchat, any Android
 * WebView). Installing from them yields a legacy package that Google Play Protect blocks, and they cannot keep a
 * session for the installed app: the user has to open the link in Chrome or Safari.
 */
export function isInAppBrowser(ua: string): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|BytedanceWebview|musical_ly|Snapchat|Line\/|; wv\)/.test(ua);
}

/** Android intent that opens the same page in Chrome, falling back to the page itself if Chrome is missing. */
export function chromeIntentUrl(href: string): string {
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}
