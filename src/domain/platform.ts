export type Platform = "ios" | "android" | "other";

export function detectPlatform(ua: string, maxTouchPoints: number): Platform {
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  // iPadOS 13+ reports itself as a Mac; only touch distinguishes it.
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return "ios";
  return "other";
}
