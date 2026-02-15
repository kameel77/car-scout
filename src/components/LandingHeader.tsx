import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const navLinks = [
  { label: 'Strona główna', to: '/' },
  { label: 'Samochody', to: '/samochody' },
  { label: 'Kontakt', to: '/kontakt' },
];

export function LandingHeader() {
  const location = useLocation();

  return (
    <nav className="landing-nav" id="landing-nav">
      <div className="landing-nav__inner">
        <Link to="/" className="landing-logo" aria-label="CarSalon - strona główna">
          Car<span>Salon</span>
        </Link>

        <ul className="landing-nav__links">
          {navLinks.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className={location.pathname === link.to ? 'is-active' : ''}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/samochody" className="landing-nav__cta">
              Znajdź auto
            </Link>
          </li>
        </ul>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="landing-nav__mobile-btn" aria-label="Otwórz menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="mt-8 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} className="text-lg font-medium">
                  {link.label}
                </Link>
              ))}
              <Link to="/samochody" className="landing-nav__cta text-center mt-2">
                Znajdź auto
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
