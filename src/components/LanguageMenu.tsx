import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface LanguageOption {
  code: string;
  label: string;
  flag: string;
}

interface LanguageMenuProps {
  languages: LanguageOption[];
  current: LanguageOption;
  currentCode: string;
  onLanguageChange: (code: string) => void;
}

// Ładowany leniwie z Header (pierwsza interakcja z przełącznikiem języka), żeby Radix
// DropdownMenu + floating-ui nie trafiały do głównego chunka.
export default function LanguageMenu({ languages, current, currentCode, onLanguageChange }: LanguageMenuProps) {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:bg-slate-100">
          <Globe className="h-4 w-4" />
          <span>{current.flag}</span>
          <span className="hidden xl:inline">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => onLanguageChange(lang.code)}
            className={cn(
              'gap-2',
              currentCode === lang.code && 'bg-orange-50 text-orange-600'
            )}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
