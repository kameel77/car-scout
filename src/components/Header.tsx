import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Car, Globe, X, Menu } from 'lucide-react';
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

const ALL_LANGUAGES = [
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

interface HeaderProps {
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

const navLinks = [
  { label: 'Samochody', to: '/samochody' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Kontakt', to: '/kontakt' },
];

export function Header({ onClearFilters, hasActiveFilters }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { data: settings, isLoading: isSettingsLoading } = useAppSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);

  const enabledLanguages = React.useMemo(() => {
    const codes = settings?.enabledLanguages || ['pl'];
    return ALL_LANGUAGES.filter(lang => codes.includes(lang.code));
  }, [settings?.enabledLanguages]);

  const currentLanguage = ALL_LANGUAGES.find((l) => l.code === i18n.language) || ALL_LANGUAGES[0];

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
  };

  const isSearchPage = location.pathname === '/' || location.pathname === '/search' || location.pathname === '/samochody';

  const getHeaderLogoText = () => {
    if (!settings) return null;
    const lang = i18n.language;
    if (lang === 'de') return settings.headerLogoTextDe;
    if (lang === 'en') return settings.headerLogoTextEn;
    return settings.headerLogoTextPl;
  };

  const getSiteName = () => {
    if (!settings) return 'Car Scout';
    const lang = i18n.language;
    let name = '';
    if (lang === 'de') name = settings.siteNameDe;
    else if (lang === 'en') name = settings.siteNameEn;
    else name = settings.siteNamePl;

    return name?.trim() || 'Car Scout';
  };

  const getSiteNameParts = () => {
    const name = getSiteName();
    if (name === 'Car Scout') return { part1: 'Car', part2: 'Scout' };

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

  return (
    <header id="landing-nav" className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-[72px] items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-shrink-0">
          {settings?.headerLogoUrl ? (
            <img
              src={buildAssetUrl(settings.headerLogoUrl)}
              alt={siteName}
              className="h-[2.5rem] w-auto max-w-[200px] object-contain"
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
              className="text-[10px] text-muted-foreground leading-tight border-l pl-3 border-border hidden sm:block max-w-[120px]"
              dangerouslySetInnerHTML={{ __html: headerLogoText }}
            />
          )}
        </Link>

        {/* Desktop Navigation & Actions */}
        <div className="hidden md:flex items-center gap-10">
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "text-base font-semibold transition-all hover:text-[#F97316]",
                  location.pathname === link.to ? "text-[#F97316]" : "text-[#4A4E69]"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-6">
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

            {/* CTA Button */}
            <Link
              to="/samochody"
              className="hidden sm:inline-flex h-10 items-center justify-center rounded-full bg-[#F97316] px-6 text-sm font-semibold text-white transition-all hover:bg-[#EA580C] hover:shadow-lg hover:shadow-orange-200 active:scale-95"
            >
              Znajdź auto
            </Link>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link
            to="/samochody"
            className="flex sm:hidden h-9 items-center justify-center rounded-full bg-[#F97316] px-4 text-xs font-semibold text-white"
          >
            Znajdź auto
          </Link>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-[#2D3142]">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] p-0">
              <div className="flex flex-col h-full bg-white">
                <div className="p-6 border-b">
                  {settings?.headerLogoUrl ? (
                    <img
                      src={buildAssetUrl(settings.headerLogoUrl)}
                      alt={siteName}
                      className="h-8 w-auto object-contain"
                    />
                  ) : (
                    <h1 className="text-xl font-bold tracking-tight">
                      <span className="text-[#2D3142]">{part1}</span>
                      {part2 && <span className="text-[#F97316]">{part2}</span>}
                    </h1>
                  )}
                </div>

                <nav className="flex-1 p-6 space-y-4">
                  {navLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "block text-lg font-medium transition-colors p-2 rounded-lg",
                        location.pathname === link.to ? "bg-orange-50 text-[#F97316]" : "text-[#4A4E69] hover:bg-slate-50"
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <Link
                    to="/samochody"
                    onClick={() => setIsOpen(false)}
                    className="block w-full text-center mt-6 h-12 flex items-center justify-center rounded-xl bg-[#F97316] text-white font-semibold"
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
