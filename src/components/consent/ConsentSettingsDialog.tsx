import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useConsent } from '@/hooks/useConsent';

interface ConsentSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ConsentSettingsDialog({ open, onOpenChange }: ConsentSettingsDialogProps) {
    const { t } = useTranslation();
    const { choice, accept } = useConsent();
    const [analytics, setAnalytics] = useState<boolean>(choice?.analytics ?? false);
    const [marketing, setMarketing] = useState<boolean>(choice?.marketing ?? false);

    useEffect(() => {
        if (open) {
            setAnalytics(choice?.analytics ?? false);
            setMarketing(choice?.marketing ?? false);
        }
    }, [open, choice]);

    const close = () => onOpenChange(false);

    const saveAndClose = (next: { analytics: boolean; marketing: boolean }) => {
        accept(next);
        close();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('consent.dialog.title')}</DialogTitle>
                    <DialogDescription>{t('consent.dialog.description')}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <CategoryRow
                        title={t('consent.categories.necessary.title')}
                        description={t('consent.categories.necessary.description')}
                        alwaysOnLabel={t('consent.categories.necessary.always')}
                        alwaysOn
                    />
                    <CategoryRow
                        title={t('consent.categories.analytics.title')}
                        description={t('consent.categories.analytics.description')}
                        checked={analytics}
                        onChange={setAnalytics}
                    />
                    <CategoryRow
                        title={t('consent.categories.marketing.title')}
                        description={t('consent.categories.marketing.description')}
                        checked={marketing}
                        onChange={setMarketing}
                    />
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => saveAndClose({ analytics: false, marketing: false })}
                    >
                        {t('consent.dialog.rejectOptional')}
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => saveAndClose({ analytics, marketing })}
                        >
                            {t('consent.dialog.save')}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => saveAndClose({ analytics: true, marketing: true })}
                        >
                            {t('consent.dialog.acceptAll')}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface CategoryRowProps {
    title: string;
    description: string;
    alwaysOn?: boolean;
    alwaysOnLabel?: string;
    checked?: boolean;
    onChange?: (next: boolean) => void;
}

function CategoryRow({ title, description, alwaysOn, alwaysOnLabel, checked, onChange }: CategoryRowProps) {
    return (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
            <div className="min-w-0">
                <div className="font-semibold text-foreground">{title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            {alwaysOn ? (
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {alwaysOnLabel}
                </span>
            ) : (
                <Switch checked={!!checked} onCheckedChange={onChange} />
            )}
        </div>
    );
}
