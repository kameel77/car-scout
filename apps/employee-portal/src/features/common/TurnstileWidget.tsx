import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: 'light' | 'dark' | 'auto';
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey,
  onVerify,
  onExpire,
  onError,
  theme = 'light',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token: string) => {
            if (!isCancelled) onVerify(token);
          },
          'expired-callback': () => {
            if (!isCancelled && onExpire) onExpire();
          },
          'error-callback': () => {
            if (!isCancelled && onError) onError();
          },
        });
        widgetIdRef.current = id;
        if (!isCancelled) {
          setIsRendered(true);
          setIsUnavailable(false);
        }
      } catch (err) {
        console.warn('Failed to render Turnstile widget', err);
        if (!isCancelled) {
          setIsUnavailable(true);
          if (onError) onError();
        }
      }
    };

    // If script is already loaded
    if (window.turnstile) {
      renderWidget();
    } else {
      // Check if script tag exists
      let script = document.querySelector('script[src*="turnstile"]') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      const handleScriptError = () => {
        if (!isCancelled) {
          setIsUnavailable(true);
          if (onError) onError();
        }
      };
      script.addEventListener('error', handleScriptError);

      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          if (!isCancelled) renderWidget();
        }
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (!widgetIdRef.current && !isCancelled) {
          setIsUnavailable(true);
          if (onError) onError();
        }
      }, 4000);

      return () => {
        isCancelled = true;
        clearInterval(interval);
        clearTimeout(timeout);
        script?.removeEventListener('error', handleScriptError);
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignore
          }
          widgetIdRef.current = null;
        }
      };
    }

    return () => {
      isCancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, onVerify, onExpire, onError]);

  if (isUnavailable) {
    return (
      <div
        role="alert"
        className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center my-2"
      >
        Weryfikacja antyspamowa niedostępna - spróbuj odświeżyć stronę.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={isRendered ? 'my-3 min-h-[65px] flex items-center justify-center' : 'h-0 overflow-hidden'}
    />
  );
};
