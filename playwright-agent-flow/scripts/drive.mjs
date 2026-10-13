// Headed Playwright driver template for Phase 1 (exploration).
//
// Copy into the repo (so `playwright` resolves), edit the TODOs, then:
//   DISPLAY=:0 node .flow.mjs            # WSL (WSLg); omit DISPLAY on a desktop
//
// This is throwaway. Once the flow works, promote the real steps into a
// @playwright/test spec (see the skill). `waitForTimeout` is fine HERE only.

import { chromium } from "playwright";

const URL = process.env.URL || "https://localhost:3000";
const HEADED = process.env.HEADLESS !== "1";

const browser = await chromium.launch({
  headless: !HEADED,
  // If Playwright's revision is missing, point at one you have:
  // executablePath: "/home/you/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
  args: ["--no-sandbox", "--ignore-certificate-errors"],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();

page.on("console", (m) => console.log(`[console:${m.type()}]`, m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", String(e)));
page.on("requestfailed", (r) =>
  console.log("[requestfailed]", r.url(), r.failure()?.errorText)
);

// TODO: override runtime config if needed (see references/environments.md).
// await page.route("**/env-config.js", async (route) => { ... });

console.log("opening", URL);
await page.goto(URL, { waitUntil: "domcontentloaded" });

// --- TODO: the flow ------------------------------------------------------
await page.waitForTimeout(2000); // exploration only
// await page.pause();           // opens the inspector, great when unsure
// await page.getByRole("button", { name: /connect/i }).click();
// -------------------------------------------------------------------------

const bodyText = await page.evaluate(() =>
  document.body.innerText.slice(0, 800)
);
await page.screenshot({ path: "flow.png" });
console.log("---- page text ----\n" + bodyText);
console.log("---- screenshot: flow.png ----");

// Keep the window up so the human can watch the end state.
await page.waitForTimeout(HEADED ? 8000 : 0);
await browser.close();
