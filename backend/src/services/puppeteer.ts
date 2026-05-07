import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

let browserPromise: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  // @sparticuz/chromium ships a Linux-only binary that fails on macOS dev hosts.
  // When PUPPETEER_EXECUTABLE_PATH is set we use the system Chrome with minimal,
  // isolated args (own user-data-dir avoids conflict with the user's running Chrome).
  // Production (no override) keeps the sparticuz Lambda-tuned flags.
  const localChrome = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (localChrome) {
    return puppeteer.launch({
      executablePath: localChrome,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--user-data-dir=/tmp/puppeteer-onepager-${process.pid}`,
      ],
    });
  }
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
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
