declare global {
    interface Window {
        clarity?: (...args: unknown[]) => void;
    }
}

export function initClarity(projectId: string) {
    if (window.clarity) return;

    (function (c: Window, l: Document, a: string, r: string, i: string) {
        (c as any)[a] =
            (c as any)[a] ||
            function () {
                ((c as any)[a].q = (c as any)[a].q || []).push(arguments);
            };
        const t = l.createElement(r) as HTMLScriptElement;
        t.async = true;
        t.src = 'https://www.clarity.ms/tag/' + i;
        const y = l.getElementsByTagName(r)[0];
        y.parentNode?.insertBefore(t, y);
    })(window, document, 'clarity', 'script', projectId);
}
