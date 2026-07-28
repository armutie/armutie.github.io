import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, "../..");
const viteBin = resolve(repositoryRoot, "node_modules/vite/bin/vite.js");
const screenshotDir = resolve(repositoryRoot, "output/playwright");
const port = 4178;
const baseUrl = `http://127.0.0.1:${port}/food/`;

const server = spawn(
  process.execPath,
  [
    viteBin,
    "--config",
    resolve(repositoryRoot, "food-app/vite.config.ts"),
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  {
    cwd: repositoryRoot,
    env: { ...process.env, VITE_DEMO_MODE: "true" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);

let serverError = "";
server.stderr.on("data", (chunk) => {
  serverError += chunk.toString();
});

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  throw new Error(`Vite did not start in time.\n${serverError}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let browser;
try {
  await waitForServer();
  await mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Today’s plate" }).waitFor();
  assert(await page.getByText("Demo mode").isVisible(), "Demo mode must be visibly labelled.");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Dashboard overflows the mobile viewport.");
  await page.screenshot({ path: resolve(screenshotDir, "dashboard-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 320, height: 700 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Dashboard overflows at 320 px.");
  await page.setViewportSize({ width: 375, height: 812 });

  await page.getByRole("link", { name: "Add meal" }).click();
  await page.getByRole("button", { name: "Use demo plate" }).click();
  await page.getByAltText("Meal ready for analysis").waitFor();
  await page.getByRole("button", { name: "Analyze meal" }).click();
  await page.getByRole("heading", { name: "Herb chicken plate" }).waitFor({ timeout: 15_000 });

  const firstFoodName = page.getByLabel("Food name").first();
  await firstFoodName.fill("Confirmed lemon-herb chicken");
  await page.getByLabel("Serving weight").first().fill("200");
  await page.getByRole("button", { name: "Confirm item" }).first().click();
  await page.setViewportSize({ width: 430, height: 860 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Review overflows at 430 px.");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: resolve(screenshotDir, "review-mobile.png"), fullPage: true });

  await page.getByRole("button", { name: "Save meal" }).click();
  await page.getByRole("heading", { name: "Herb chicken plate" }).waitFor({ timeout: 10_000 });
  await page.getByText("Confirmed lemon-herb chicken").waitFor();
  assert(page.url().includes("#/meal/"), "Saving should navigate to the meal detail.");

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("heading", { name: "Edit Herb chicken plate" }).waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("link", { name: "History" }).click();
  await page.getByRole("heading", { name: "History" }).waitFor();
  await page.getByText("Herb chicken plate").first().waitFor();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "Today" }).click();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Dashboard overflows the desktop viewport.");
  await page.screenshot({ path: resolve(screenshotDir, "dashboard-desktop.png"), fullPage: true });

  assert(consoleErrors.length === 0, `Browser console errors:\n${consoleErrors.join("\n")}`);
  console.log("E2E passed: demo photo -> analysis -> correction -> save -> detail -> history.");
  console.log(`Screenshots: ${screenshotDir}`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
