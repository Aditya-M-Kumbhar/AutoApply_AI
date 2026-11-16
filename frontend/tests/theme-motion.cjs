const { chromium } = require("../../backend/node_modules/playwright");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://localhost:5173";
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      colorScheme: "dark",
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/v1/auth/profile", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.goto(base);
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    const toggle = page.getByRole("switch", { name: "Night mode" });
    assert.equal(await toggle.getAttribute("aria-checked"), "true");
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    const duration = await page
      .locator(".theme-sun")
      .evaluate((node) =>
        parseFloat(getComputedStyle(node).transitionDuration),
      );
    assert.ok(duration > 0 && duration < 1);
    await toggle.click();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    // Rapid changes must always leave the saved setting and visible state in sync.
    await toggle.click();
    await toggle.click();
    await toggle.click();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem("autoapplyai:theme")),
      "light",
    );
    await page.emulateMedia({ colorScheme: "dark" });
    assert.equal(await toggle.getAttribute("aria-checked"), "false");
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".theme-sun")
        .evaluate((node) => getComputedStyle(node).transitionDuration),
      "0s",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS system theme, explicit preference, rapid toggles, animated sun/moon transitions, and reduced motion",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
