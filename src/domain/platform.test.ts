import { detectPlatform } from "@/domain/platform";

test("detects iOS, Android, iPadOS and others", () => {
  expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", 5)).toBe("ios");
  expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)", 5)).toBe("android");
  expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
  expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("other");
  expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0)).toBe("other");
});
