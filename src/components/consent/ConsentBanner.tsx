import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useConsent } from '@/hooks/useConsent';
import { useAppSettings } from '@/hooks/useAppSettings';
import { ConsentSettingsDialog } from './ConsentSettingsDialog';

export function ConsentBanner() {
    const { t, i18n } = useTranslation();
    const { hasDecided, acceptAll, rejectOptional } = useConsent();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const { data: settings } = useAppSettings();

    useEffect(() => {
        const handler = () => setSettingsOpen(true);
        window.addEventListener('open-consent-settings', handler);
        return () => window.removeEventListener('open-consent-settings', handler);
    }, []);

    const showBanner = !hasDecided;

    const lang = i18n.language.slice(0, 2).toLowerCase();
    const legalDocs = settings?.legalDocuments as Record<string, Record<string, string>> | undefined;
    const cookiesDoc = legalDocs?.cookies?.[lang] ?? legalDocs?.cookies?.pl;

    return (
        <>
            {showBanner && (
                <div
                    role="dialog"
                    aria-label={t('consent.banner.title')}
                    className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-background/95 backdrop-blur-sm shadow-2xl"
                >
                    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 lg:pr-8">
                            <p className="text-sm font-semibold text-foreground">
                                {t('consent.banner.title')}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t('consent.banner.body')}
                                {cookiesDoc && (
                                    <>
                                        {' '}
                                        <a
                                            href={cookiesDoc}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline underline-offset-2 hover:text-foreground"
                                        >
                                            {t('consent.banner.policyLink')}
                                        </a>
                                    </>
                                )}
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setSettingsOpen(true)}
                            >
                                {t('consent.banner.settings')}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={rejectOptional}
                            >
                                {t('consent.banner.rejectOptional')}
                            </Button>
                            <Button
                                type="button"
                                onClick={acceptAll}
                            >
                                {t('consent.banner.acceptAll')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ConsentSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        </>
    );
}

export function openConsentSettings() {
    window.dispatchEvent(new Event('open-consent-settings'));
}
