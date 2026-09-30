import { clearSsrDataCache } from '@/lib/ssrData';

// Mimics the backend-injected <script type="application/json" id="..."> block.
export function setSsrJson(id: string, value: unknown): void {
    removeSsrJson(id);
    const el = document.createElement('script');
    el.type = 'application/json';
    el.id = id;
    el.textContent = JSON.stringify(value);
    document.head.appendChild(el);
    clearSsrDataCache();
}

export function removeSsrJson(id: string): void {
    document.getElementById(id)?.remove();
    clearSsrDataCache();
}
