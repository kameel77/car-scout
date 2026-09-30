// SSR→client data handoff via non-executable JSON blocks (<script type="application/json" id="...">),
// injected by backend render.ts. Unlike inline executable scripts they do not violate CSP script-src.
const cache = new Map<string, unknown>();

export function readSsrJson<T>(id: string): T | undefined {
    if (typeof document === 'undefined') return undefined;
    if (cache.has(id)) return cache.get(id) as T | undefined;
    let value: T | undefined;
    try {
        const el = document.getElementById(id);
        if (el?.textContent) value = JSON.parse(el.textContent) as T;
    } catch {
        value = undefined;
    }
    cache.set(id, value);
    return value;
}

// Test-only: drop memoized values so a test can swap the DOM blocks.
export function clearSsrDataCache(): void {
    cache.clear();
}
