import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Tracks SPA page navigation in Microsoft Clarity.
 * Must be rendered inside <BrowserRouter>.
 *
 * Clarity auto-detects History API changes but lazy GTM loading can
 * cause it to miss the first few navigations. Calling `clarity('upgrade')`
 * on every route change guarantees the session is actively recorded.
 */
export function ClarityPageTracker() {
    const location = useLocation();

    useEffect(() => {
        if (window.clarity) {
            window.clarity('upgrade', 'SPA Page View');
        }
    }, [location.pathname]);

    return null;
}
