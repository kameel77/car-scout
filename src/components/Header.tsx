import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Menu, Gift, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { useAppSettings } from '@/hooks/useAppSettings';
import { buildAssetUrl } from '@/utils/assets';
import { usePersonalOffer } from '@/contexts/PersonalOfferContext';
import { useBrand } from '@/contexts/BrandContext';

const ALL_LANGUAGES = [
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

interface HeaderProps {
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

const ALL_NAV_LINKS = [
  { key: 'samochody', label: 'Samochody', to: '/samochody' },
  { key: 'nowe', label: 'Nowe', to: '/nowe' },
  { key: 'uzywane', label: 'Używane', to: '/uzywane' },
  { key: 'wynajem', label: 'Wynajem', to: '/wynajem-dlugoterminowy' },
  { key: 'faq', label: 'FAQ', to: '/faq' },
  { key: 'kontakt', label: 'Kontakt', to: '/kontakt' },
];

export function Header({ onClearFilters, hasActiveFilters }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { data: settings, isLoading: isSettingsLoading } = useAppSettings();
  const phoneForSales = settings?.salesContactPhone || settings?.legalContactPhone || '';
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  const { hasPersonalOffer } = usePersonalOffer();
  const { config } = useBrand();

  const navItems = React.useMemo(() => {
    const visibility: string[] = settings?.navItemsVisibility ?? ['samochody', 'wynajem'];
    const splitNewUsed = Boolean(settings?.splitNewUsed);

    return ALL_NAV_LINKS.filter((link) => {
      // FAQ and Kontakt are always shown
      if (link.key === 'faq' || link.key === 'kontakt') return true;
      // When splitNewUsed is active: hide 'samochody', show 'nowe'+'uzywane'
      if (splitNewUsed) {
        if (link.key === 'samochody') return false;
        if (link.key === 'nowe' || link.key === 'uzywane') return true;
      } else {
        // Default: hide nowe/uzywane, show samochody based on visibility
        if (link.key === 'nowe' || link.key === 'uzywane') return false;
      }
      return visibility.includes(link.key);
    });
  }, [settings?.navItemsVisibility, settings?.splitNewUsed]);

  const enabledLanguages = React.useMemo(() => {
    const codes = settings?.enabledLanguages || ['pl'];
    return ALL_LANGUAGES.filter(lang => codes.includes(lang.code));
  }, [settings?.enabledLanguages]);

  const currentLanguage = ALL_LANGUAGES.find((l) => l.code === i18n.language) || ALL_LANGUAGES[0];

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
  };

  const isSearchPage = location.pathname === '/' || location.pathname === '/search' || location.pathname === '/samochody' || location.pathname === '/nowe' || location.pathname === '/uzywane';

  const getHeaderLogoText = () => {
    if (!settings) return null;
    const lang = i18n.language;
    if (lang === 'de') return settings.headerLogoTextDe;
    if (lang === 'en') return settings.headerLogoTextEn;
    return settings.headerLogoTextPl;
  };

  const getSiteName = () => {
    if (!settings) return config.name;
    const lang = i18n.language;
    let name = '';
    if (lang === 'de') name = settings.siteNameDe;
    else if (lang === 'en') name = settings.siteNameEn;
    else name = settings.siteNamePl;

    return name?.trim() || config.name;
  };

  const getSiteNameParts = () => {
    const name = getSiteName();
    const firstSpaceIndex = name.indexOf(' ');
    if (firstSpaceIndex === -1) {
      if (name.length > 8) {
        return { part1: name, part2: '' };
      }
      return { part1: name, part2: '' };
    }

    return {
      part1: name.substring(0, firstSpaceIndex),
      part2: name.substring(firstSpaceIndex + 1)
    };
  };

  const headerLogoText = getHeaderLogoText();
  const siteName = getSiteName();
  const { part1, part2 } = getSiteNameParts();
  const headerLogoSrc = settings?.headerLogoUrl || config.logo?.header || '';

  return (
    <header id="landing-nav" className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
      <div className="container flex min-h-[72px] py-2 lg:h-[80px] items-center justify-between gap-2">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-shrink-0">
          {headerLogoSrc ? (
            <img
              src={buildAssetUrl(headerLogoSrc)}
              alt={siteName}
              className="h-14 md:h-16 w-auto max-w-[240px] object-contain"
              loading="lazy"
            />
          ) : (
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              <span className="text-[#2D3142]">{part1}</span>
              {part2 && <span className="text-[#F97316]">{part2}</span>}
            </h1>
          )}
          {headerLogoText && (
            <span
              className="text-[11px] text-muted-foreground leading-tight border-l pl-2 border-border hidden sm:block max-w-[120px]"
              dangerouslySetInnerHTML={{ __html: headerLogoText }}
            />
          )}
        </Link>

        {/* Desktop Navigation & Actions */}
        <div className="hidden md:flex items-center gap-10">
          <nav className="hidden lg:flex items-center gap-8">
            {navItems.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "text-base font-semibold transition-all hover:text-accent",
                  location.pathname === link.to ? "text-accent" : "text-[#4A4E69]"
                )}
              >
                {link.label}
              </Link>
            ))}
            {hasPersonalOffer && (
              <Link
                to="/dla-ciebie"
                className={cn(
                  "flex items-center gap-1.5 text-sm font-bold px-4 py-1.5 rounded-full transition-all",
                  location.pathname === '/dla-ciebie'
                    ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md shadow-orange-200"
                    : "bg-gradient-to-r from-orange-50 to-amber-50 text-orange-600 hover:from-orange-100 hover:to-amber-100 border border-orange-200"
                )}
              >
                <Gift className="h-3.5 w-3.5" />
                Oferta dla Ciebie
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            {enabledLanguages.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-[#4A4E69] hover:bg-slate-100">
                    <Globe className="h-4 w-4" />
                    <span>{currentLanguage.flag}</span>
                    <span className="hidden xl:inline">{currentLanguage.label}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {enabledLanguages.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={cn(
                        'gap-2',
                        i18n.language === lang.code && 'bg-orange-50 text-orange-600'
                      )}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Phone Button */}
            {phoneForSales && (
              <a
                href={`tel:${phoneForSales}`}
                aria-label="Zadzwoń do nas"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent border border-accent/20 hover:bg-accent hover:text-white transition-all duration-200 hover:shadow-md hover:shadow-accent/20 active:scale-95"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}

            {/* CTA Button */}
            <Link
              to="/samochody"
              className="hidden sm:inline-flex h-10 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-all hover:opacity-90 hover:shadow-lg active:scale-95"
            >
              Znajdź auto
            </Link>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className="flex items-center gap-2 lg:hidden">
          {/* Phone circle - mobile */}
          {phoneForSales && (
            <a
              href={`tel:${phoneForSales}`}
              aria-label="Zadzwoń do nas"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-accent/10 text-accent border border-accent/20 hover:bg-accent hover:text-white transition-all duration-200 active:scale-95"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-[#2D3142]">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] p-0">
              <div className="flex flex-col h-full bg-white">
                <div className="p-6 border-b">
                  {headerLogoSrc ? (
                    <img
                      src={buildAssetUrl(headerLogoSrc)}
                      alt={siteName}
                      className="h-12 w-auto object-contain"
                    />
                  ) : (
                    <h1 className="text-xl font-bold tracking-tight">
                      <span className="text-[#2D3142]">{part1}</span>
                      {part2 && <span className="text-[#F97316]">{part2}</span>}
                    </h1>
                  )}
                </div>

                <nav className="flex-1 p-6 space-y-4">
                  {navItems.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "block text-lg font-medium transition-colors p-2 rounded-lg",
                        location.pathname === link.to ? "bg-accent/10 text-accent" : "text-[#4A4E69] hover:bg-slate-50"
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                  {hasPersonalOffer && (
                    <Link
                      to="/dla-ciebie"
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-2 text-lg font-semibold p-2 rounded-lg transition-colors",
                        location.pathname === '/dla-ciebie'
                          ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white"
                          : "bg-gradient-to-r from-orange-50 to-amber-50 text-orange-600 border border-orange-200"
                      )}
                    >
                      <Gift className="h-4 w-4" />
                      Oferta dla Ciebie
                    </Link>
                  )}
                  <Link
                    to="/samochody"
                    onClick={() => setIsOpen(false)}
                    className="block w-full text-center mt-6 h-12 flex items-center justify-center rounded-xl bg-accent text-accent-foreground font-semibold"
                  >
                    Znajdź auto
                  </Link>
                </nav>

                <div className="p-6 border-t bg-slate-50">

                  {enabledLanguages.length > 1 && (
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('header.language')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {enabledLanguages.map((lang) => (
                          <Button
                            key={lang.code}
                            variant={i18n.language === lang.code ? 'chip-active' : 'chip'}
                            size="chip"
                            onClick={() => {
                              handleLanguageChange(lang.code);
                              setIsOpen(false);
                            }}
                          >
                            <span>{lang.flag}</span>
                            <span>{lang.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
