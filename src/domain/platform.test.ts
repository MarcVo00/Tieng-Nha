import { chromeIntentUrl, detectPlatform, installBlocker, isInAppBrowser } from "@/domain/platform";

test("detects iOS, Android, iPadOS and others", () => {
  expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", 5)).toBe("ios");
  expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)", 5)).toBe("android");
  expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
  expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("other");
  expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0)).toBe("other");
});

test("recognises the browsers built into messaging and social apps", () => {
  const android = "Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36";
  expect(isInAppBrowser(`${android} Instagram 350.0.0.0 Android`)).toBe(true);
  expect(isInAppBrowser(`${android} [FB_IAB/Orca-Android;FBAV/480.0.0;]`)).toBe(true); // Messenger
  expect(isInAppBrowser(`${android} [FB_IAB/FB4A;FBAV/480.0.0;]`)).toBe(true); // Facebook
  expect(isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0]")).toBe(true);
  expect(isInAppBrowser(`${android} musical_ly_2023 BytedanceWebview/d8a21c6`)).toBe(true); // TikTok
  expect(isInAppBrowser(`${android} Snapchat/12.0`)).toBe(true);
  expect(isInAppBrowser(android)).toBe(true); // any Android WebView ("; wv)")
  // Real browsers are not flagged.
  expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36")).toBe(false);
  expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36")).toBe(false);
  expect(isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toBe(false);
});

test("builds an Android intent that reopens the same page in Chrome", () => {
  expect(chromeIntentUrl("https://tieng-nha.netlify.app/leaderboard?x=1")).toBe(
    "intent://tieng-nha.netlify.app/leaderboard?x=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Ftieng-nha.netlify.app%2Fleaderboard%3Fx%3D1;end",
  );
});

test("names what blocks a proper install: a messaging app's browser, or Samsung Internet", () => {
  expect(installBlocker("Mozilla/5.0 (Linux; Android 14; SM-S911B; wv) Chrome/129.0 Mobile Safari/537.36 Instagram 350.0")).toBe("in-app");
  expect(installBlocker("Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0 Mobile Safari/537.36")).toBe("samsung");
  expect(installBlocker("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36")).toBeNull();
  expect(installBlocker("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBeNull();
});
