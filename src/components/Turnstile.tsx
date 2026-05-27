import React from 'react';

interface TurnstileProps {
    onVerify: (token: string) => void;
    onExpire?: () => void;
    onError?: () => void;
}

declare global {
    interface Window {
        onloadTurnstileCallback?: () => void;
        turnstile?: {
            render: (
                container: string | HTMLElement,
                options: {
                    sitekey: string;
                    callback: (token: string) => void;
                    'expired-callback'?: () => void;
                    'error-callback'?: () => void;
                    theme?: 'light' | 'dark' | 'auto';
                }
            ) => string;
            remove: (widgetId: string) => void;
        };
    }
}

export function Turnstile({ onVerify, onExpire, onError }: TurnstileProps) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const widgetIdRef = React.useRef<string | null>(null);

    // Turnstile Site Key from environment or official Cloudflare testing key (always passes)
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

    React.useEffect(() => {
        // 1. Define callback for script load
        window.onloadTurnstileCallback = () => {
            if (containerRef.current && window.turnstile && !widgetIdRef.current) {
                try {
                    const id = window.turnstile.render(containerRef.current, {
                        sitekey: siteKey,
                        callback: (token) => onVerify(token),
                        'expired-callback': () => {
                            onExpire?.();
                        },
                        'error-callback': () => {
                            onError?.();
                        },
                        theme: 'auto',
                    });
                    widgetIdRef.current = id;
                } catch (e) {
                    console.error('Turnstile render error:', e);
                }
            }
        };

        // 2. Load script if not already present
        const existingScript = document.getElementById('cloudflare-turnstile-script');
        if (!existingScript) {
            const script = document.createElement('script');
            script.id = 'cloudflare-turnstile-script';
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback';
            script.async = true;
            script.defer = true;
            document.body.appendChild(script);
        } else if (window.turnstile && containerRef.current && !widgetIdRef.current) {
            // Script already loaded, render immediately
            window.onloadTurnstileCallback();
        }

        // Cleanup
        return () => {
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch (e) {
                    // ignore
                }
                widgetIdRef.current = null;
            }
        };
    }, [siteKey, onVerify, onExpire, onError]);

    return (
        <div 
            ref={containerRef} 
            className="cf-turnstile my-3 flex justify-center sm:justify-start" 
            style={{ minHeight: '65px' }}
        />
    );
}
