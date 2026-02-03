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

  const isSearchPage = location.pathname === '/' || location.pathname === '/search';

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
        // If it's one long word, just return it as part1
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

  if (isSettingsLoading) {
    return <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"><div className="container flex h-20 items-center justify-between"></div></header>;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-[var(--header-height)] items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          {settings?.headerLogoUrl ? (
            <img
              src={buildAssetUrl(settings.headerLogoUrl)}
              alt={siteName}
              className="h-[3.25rem] w-auto max-w-[260px] object-contain"
              loading="lazy"
            />
          ) : (
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-primary">{part1}</span>
              {part2 && <span className="text-accent">{part2}</span>}
            </h1>
          )}
          {headerLogoText && (
            <span
              className="text-xs text-muted-foreground leading-tight border-l pl-3 border-border hidden sm:block"
              dangerouslySetInnerHTML={{ __html: headerLogoText }}
            />
          )}
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-4">
          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Globe className="h-4 w-4" />
                <span>{currentLanguage.flag}</span>
                <span className="hidden lg:inline">{currentLanguage.label}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {enabledLanguages.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    'gap-2',
                    i18n.language === lang.code && 'bg-accent'
                  )}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="flex flex-col gap-6 pt-6">
              <div className="flex items-center">
                {settings?.headerLogoUrl ? (
                  <img
                    src={buildAssetUrl(settings.headerLogoUrl)}
                    alt={siteName}
                    className="h-[3.25rem] w-auto max-w-[260px] object-contain"
                    loading="lazy"
                  />
                ) : (
                  <h1 className="text-3xl font-bold tracking-tight">
                    <span className="text-primary">{part1}</span>
                    {part2 && <span className="text-accent">{part2}</span>}
                  </h1>
                )}
              </div>

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
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
