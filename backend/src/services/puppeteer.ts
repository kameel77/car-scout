import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

let browserPromise: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  // Allow overriding executable path for local dev — @sparticuz/chromium ships
  // a Linux-only binary that fails with ENOEXEC on macOS / non-x64 dev hosts.
  // Set PUPPETEER_EXECUTABLE_PATH in backend/.env to e.g. system Chrome.
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath());
  return puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });
}

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launch();
  }
  try {
    const browser = await browserPromise;
    if (!browser.isConnected()) {
      browserPromise = launch();
      return await browserPromise;
    }
    return browser;
  } catch (err) {
    browserPromise = null;
    throw err;
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const current = browserPromise;
  browserPromise = null;
  try {
    const browser = await current;
    await browser.close();
  } catch {
    // ignore — already closed or never opened
  }
}
