import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, Shield, FileText, ExternalLink } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { buildAssetUrl } from '@/utils/assets';

type LegalDocKey = 'imprint' | 'privacyPolicy' | 'terms' | 'cookies';

const DOCS: { key: LegalDocKey; labelKey: string }[] = [
  { key: 'imprint', labelKey: 'footer.imprint' },
  { key: 'privacyPolicy', labelKey: 'footer.privacy' },
  { key: 'terms', labelKey: 'footer.terms' },
  { key: 'cookies', labelKey: 'footer.cookies' },
];

const normalizeLang = (code?: string) => (code || 'pl').slice(0, 2).toLowerCase();

export function Footer() {
  const { data: settings } = useAppSettings();
  const { t, i18n } = useTranslation();
  const lang = normalizeLang(i18n.language);
  const legalDocs = settings?.legalDocuments as Record<string, Record<string, string>> | undefined;

  const pickUrl = (key: LegalDocKey) => {
    const entry = legalDocs?.[key] || {};
    const priority = [lang, 'de', 'en', 'pl'].filter(
      (code, index, arr) => code && arr.indexOf(code) === index
    );

    for (const code of priority) {
      const candidate = typeof entry?.[code] === 'string' ? entry[code].trim() : '';
      if (candidate) return candidate;
    }
    return '';
  };

  const links = DOCS.map((doc) => ({
    key: doc.key,
    label: t(doc.labelKey),
    url: pickUrl(doc.key),
  })).filter((item) => item.url);

  const hasCompanyInfo =
    settings?.legalCompanyName ||
    settings?.legalAddress ||
    settings?.legalContactEmail ||
    settings?.legalContactPhone ||
    settings?.legalVatId ||
    settings?.legalRegisterNumber ||
    settings?.legalRepresentative;

  const logo = buildAssetUrl(settings?.footerLogoUrl || settings?.headerLogoUrl);
  const sloganText = React.useMemo(() => {
    const lang = normalizeLang(i18n.language);
    const candidates = [
      lang === 'en' ? settings?.legalSloganEn : null,
      lang === 'de' ? settings?.legalSloganDe : null,
      lang === 'pl' ? settings?.legalSloganPl : null,
      settings?.legalSloganEn,
      settings?.legalSloganDe,
      settings?.legalSloganPl
    ];
    const pick = candidates.find((s) => typeof s === 'string' && s.trim().length > 0);
    return pick?.trim() || '';
  }, [i18n.language, settings?.legalSloganEn, settings?.legalSloganDe, settings?.legalSloganPl]);

  return (
    <footer className="mt-12 border-t bg-slate-950 text-slate-100">
      <div className="container py-10 grid gap-10 lg:grid-cols-3">
        <div className="space-y-4">
          {logo ? (
            <img
              src={logo}
              alt="Footer logo"
              className="h-auto max-h-12 w-auto max-w-[200px] object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
              <Shield className="h-4 w-4 text-amber-300" />
              {t('footer.legal')}
            </div>
          )}
          {sloganText && (
              <p className="text-base font-semibold text-slate-50">{sloganText}</p>
          )}
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            {t('footer.documents')}
          </div>
          <div className="space-y-2">
            {links.length === 0 && (
              <p className="text-sm text-slate-400">{t('footer.missing')}</p>
            )}
            {links.map((item) => (
              <a
                key={item.key}
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm hover:border-slate-600 hover:bg-slate-900 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  {item.label}
                </span>
                <ExternalLink className="h-4 w-4 text-slate-500" />
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            {t('footer.company')}
          </div>
          {hasCompanyInfo ? (
            <ul className="space-y-1 text-sm text-slate-300">
              {settings?.legalCompanyName && <li className="font-semibold text-white">{settings.legalCompanyName}</li>}
              {settings?.legalAddress && <li>{settings.legalAddress}</li>}
              {settings?.legalVatId && <li>{t('footer.vat')}: {settings.legalVatId}</li>}
              {settings?.legalRegisterNumber && <li>{t('footer.register')}: {settings.legalRegisterNumber}</li>}
              {settings?.legalRepresentative && <li>{t('footer.representative')}: {settings.legalRepresentative}</li>}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">{t('footer.missing')}</p>
          )}

          {(settings?.legalContactEmail || settings?.legalContactPhone) && (
            <div className="pt-2 space-y-2 text-sm text-slate-200">
              <p className="text-xs uppercase tracking-wide text-slate-400">{t('footer.contact')}</p>
              {settings?.legalContactEmail && (
                <a
                  href={`mailto:${settings.legalContactEmail}`}
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span>{settings.legalContactEmail}</span>
                </a>
              )}
              {settings?.legalContactPhone && (
                <a
                  href={`tel:${settings.legalContactPhone}`}
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{settings.legalContactPhone}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
