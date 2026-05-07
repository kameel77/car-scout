import { describe, it, expect, vi, beforeEach } from 'vitest';

const launchMock = vi.fn();
const closeMock = vi.fn();
const isConnectedMock = vi.fn(() => true);

vi.mock('puppeteer-core', () => ({
  default: { launch: (...args: any[]) => launchMock(...args) },
}));

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--no-sandbox'],
    executablePath: async () => '/fake/chromium',
  },
}));

describe('puppeteer service', () => {
  beforeEach(() => {
    vi.resetModules();
    launchMock.mockReset();
    closeMock.mockReset();
    isConnectedMock.mockReset();
    isConnectedMock.mockReturnValue(true);
    launchMock.mockResolvedValue({
      isConnected: isConnectedMock,
      close: closeMock,
    });
  });

  it('lazy-inits browser on first call', async () => {
    const { getBrowser } = await import('../puppeteer');
    expect(launchMock).not.toHaveBeenCalled();
    await getBrowser();
    expect(launchMock).toHaveBeenCalledOnce();
  });

  it('returns same instance on subsequent calls', async () => {
    const { getBrowser } = await import('../puppeteer');
    const a = await getBrowser();
    const b = await getBrowser();
    expect(a).toBe(b);
    expect(launchMock).toHaveBeenCalledOnce();
  });

  it('recreates browser when disconnected', async () => {
    const { getBrowser } = await import('../puppeteer');
    await getBrowser();
    isConnectedMock.mockReturnValue(false);
    await getBrowser();
    expect(launchMock).toHaveBeenCalledTimes(2);
  });

  it('closeBrowser calls close on instance', async () => {
    const { getBrowser, closeBrowser } = await import('../puppeteer');
    await getBrowser();
    await closeBrowser();
    expect(closeMock).toHaveBeenCalledOnce();
  });
});
