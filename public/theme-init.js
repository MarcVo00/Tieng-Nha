// Runs before the first paint, so a dark theme never flashes light. A file, not inline: the CSP refuses inline scripts.
(function () {
  try {
    var t = localStorage.getItem("tn-theme") || "system";
    var dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
    document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#15110F" : "#F6F0E4");
    if (dark) document.getElementById("app-manifest").setAttribute("href", "/manifest-dark.webmanifest");
  } catch (e) {}
})();
