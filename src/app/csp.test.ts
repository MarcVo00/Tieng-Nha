import { readFileSync } from "node:fs";

// The CSP in netlify.toml refuses inline scripts: an inline one in index.html would silently stop running in production only.
test("index.html has no inline script, and the CSP keeps refusing them", () => {
  const html = readFileSync("index.html", "utf8");
  const toml = readFileSync("netlify.toml", "utf8");
  expect(html).not.toMatch(/<script(?![^>]*src=)[^>]*>/);
  expect(toml).toContain("script-src 'self';");
});
