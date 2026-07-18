import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * SPA scroll fix: przy nowej nawigacji (PUSH/REPLACE, np. klik w logo lub link)
 * przewijamy na górę strony. POP (wstecz/dalej) zostawiamy przeglądarce,
 * żeby powrót na listing przywracał zapamiętaną pozycję.
 */
export function ScrollToTop() {
    const { pathname } = useLocation();
    const navType = useNavigationType();

    useEffect(() => {
        if (navType !== 'POP') {
            window.scrollTo(0, 0);
        }
    }, [pathname, navType]);

    return null;
}
