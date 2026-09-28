export interface PortalBrandConfig {
  brandName: string;
  brandLogoUrl: string;
  portalUrl: string;
  apiUrl: string;
  turnstileSiteKey?: string;
  analyticsEnabled?: boolean;
  b2bPhone?: string;
  b2bEmail?: string;
}

export const defaultBrandConfig: PortalBrandConfig = {
  brandName: 'Benefivo',
  brandLogoUrl: '/static/logo-dark.svg',
  portalUrl: 'https://benefivo.pl',
  apiUrl: '/api',
  turnstileSiteKey: '1x00000000000000000000AA',
  analyticsEnabled: false,
  b2bPhone: '+48 22 112 09 50',
  b2bEmail: 'b2b@benefivo.pl',
};

declare global {
  interface Window {
    __PORTAL_CONFIG__?: Partial<PortalBrandConfig>;
  }
}

export function validateBrandConfig(raw: unknown): PortalBrandConfig {
  if (!raw || typeof raw !== 'object') {
    return defaultBrandConfig;
  }

  const obj = raw as Record<string, unknown>;

  const brandName =
    typeof obj.brandName === 'string' && obj.brandName.trim().length > 0
      ? obj.brandName.trim().slice(0, 100)
      : defaultBrandConfig.brandName;

  let brandLogoUrl = defaultBrandConfig.brandLogoUrl;
  if (typeof obj.brandLogoUrl === 'string') {
    const trimmed = obj.brandLogoUrl.trim();
    // Dozwolone wyłącznie bezpieczne ścieżki względne (zaczynające się od pojedynczego /) lub pełny HTTPS
    if ((trimmed.startsWith('/') && !trimmed.startsWith('//')) || trimmed.startsWith('https://')) {
      try {
        if (trimmed.startsWith('https://')) {
          new URL(trimmed);
        }
        brandLogoUrl = trimmed;
      } catch {
        brandLogoUrl = defaultBrandConfig.brandLogoUrl;
      }
    }
  }

  let portalUrl = defaultBrandConfig.portalUrl;
  if (typeof obj.portalUrl === 'string') {
    const trimmed = obj.portalUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      portalUrl = trimmed;
    }
  }

  let apiUrl = defaultBrandConfig.apiUrl;
  if (typeof obj.apiUrl === 'string') {
    const trimmed = obj.apiUrl.trim();
    if (trimmed === '/api' || trimmed.startsWith('/api/')) {
      apiUrl = trimmed;
    }
  }

  let turnstileSiteKey = defaultBrandConfig.turnstileSiteKey;
  if (typeof obj.turnstileSiteKey === 'string' && obj.turnstileSiteKey.trim().length > 0) {
    turnstileSiteKey = obj.turnstileSiteKey.trim();
  }

  const analyticsEnabled = typeof obj.analyticsEnabled === 'boolean'
    ? obj.analyticsEnabled
    : defaultBrandConfig.analyticsEnabled;

  const b2bPhone =
    typeof obj.b2bPhone === 'string' && obj.b2bPhone.trim().length > 0
      ? obj.b2bPhone.trim().slice(0, 30)
      : defaultBrandConfig.b2bPhone;

  const b2bEmail =
    typeof obj.b2bEmail === 'string' && obj.b2bEmail.trim().length > 0
      ? obj.b2bEmail.trim().slice(0, 100)
      : defaultBrandConfig.b2bEmail;

  return {
    brandName,
    brandLogoUrl,
    portalUrl,
    apiUrl,
    turnstileSiteKey,
    analyticsEnabled,
    b2bPhone,
    b2bEmail,
  };
}

let cachedConfig: PortalBrandConfig | null = null;

export async function loadPortalConfig(timeoutMs = 3000): Promise<PortalBrandConfig> {
  if (cachedConfig) return cachedConfig;

  // 1. Sprawdź window.__PORTAL_CONFIG__
  if (typeof window !== 'undefined' && window.__PORTAL_CONFIG__) {
    cachedConfig = validateBrandConfig(window.__PORTAL_CONFIG__);
    return cachedConfig;
  }

  // 2. Pobierz /runtime-config.json z timeoutem obejmującym fetch ORAZ response.json()
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch('/runtime-config.json', {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.ok) {
        const json = await response.json();
        cachedConfig = validateBrandConfig(json);
        return cachedConfig;
      }
    } catch {
      // Ignorujemy błędy sieci, timeout abort lub niepoprawny json - przechodzimy do fallbacku
    } finally {
      clearTimeout(timerId);
    }
  }

  cachedConfig = defaultBrandConfig;
  return cachedConfig;
}

export function resetCachedConfigForTesting(): void {
  cachedConfig = null;
}
