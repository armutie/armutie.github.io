import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, "../..");
const viteBin = resolve(repositoryRoot, "node_modules/vite/bin/vite.js");
const screenshotDir = resolve(repositoryRoot, "output/playwright");
const port = 4179;
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
    env: {
      ...process.env,
      VITE_DEMO_MODE: "false",
      VITE_SUPABASE_URL: "https://placeholder.supabase.co",
      VITE_SUPABASE_ANON_KEY: "placeholder-public-anon-key",
    },
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

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Continue with Google" }).waitFor();
  await page.getByRole("button", { name: "Continue with email" }).waitFor();
  await page.getByLabel("Email address").waitFor();

  const googleButton = page.getByRole("button", { name: "Continue with Google" });
  const emailButton = page.getByRole("button", { name: "Continue with email" });
  assert(
    await googleButton.evaluate((google, email) => Boolean(google.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING), await emailButton.elementHandle()),
    "Google must appear before the email fallback.",
  );
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "Authentication screen overflows at 375 px.",
  );
  await page.screenshot({ path: resolve(screenshotDir, "auth-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 320, height: 700 });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "Authentication screen overflows at 320 px.",
  );

  console.log("Auth E2E passed: Google primary -> email fallback -> mobile layout.");
  console.log(`Screenshot: ${resolve(screenshotDir, "auth-mobile.png")}`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
