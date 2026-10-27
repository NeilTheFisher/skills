import { chromium, devices } from "@playwright/test";

import { shot } from "./annotate";

const BASE = process.env.BASE ?? "https://example.com";
const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const OUT = process.env.OUT ?? "/tmp/opencode/demo";

/**
 * A five-step walkthrough: home -> sign in -> admin -> pick a page -> do the
 * thing. Replace the selectors and captions with the real flow, keep it to one
 * action per step, and stop at the moment the user gets what they came for.
 */
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();
page.setDefaultTimeout(25_000);

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await shot(page, `${OUT}/step-1.png`, {
  selector: 'a[href="/login"]',
  dir: "up",
  caption: "1 · Tap Sign in",
  badge: "1",
});

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await shot(page, `${OUT}/step-2.png`, {
  selector: "form",
  dir: "down",
  caption: "2 · Enter your email and password",
  badge: "2",
});

// The submit is gated on hydration, so a click can be swallowed. Wait for it to
// become enabled, then wait for a marker that only exists after auth; retry once.
for (let attempt = 1; attempt <= 2; attempt++) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => {
      const b = document.querySelector('button[type="submit"]');
      return !!b && !b.hasAttribute("data-disabled");
    },
    null,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(600);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  try {
    await page.locator("nav").first().waitFor({ state: "attached", timeout: 45_000 });
    break;
  } catch {
    console.log(`sign-in attempt ${attempt} did not reach the signed-in shell`);
  }
}

await page.waitForTimeout(2000);
await shot(page, `${OUT}/step-3.png`, {
  selector: "nav",
  dir: "up",
  caption: "3 · Open the menu",
  badge: "3",
});

await browser.close();
