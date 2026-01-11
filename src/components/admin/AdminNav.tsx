import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Languages, LayoutDashboard, Users, HelpCircle, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function AdminNav() {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager'] },
    { href: '/admin/translations', label: 'Translations', icon: Languages, roles: ['admin', 'manager'] },
    { href: '/admin/seo', label: 'SEO', icon: Search, roles: ['admin', 'manager'] },
    { href: '/admin/faq', label: 'FAQ', icon: HelpCircle, roles: ['admin', 'manager'] },
    { href: '/admin/users', label: 'Users', icon: Users, roles: ['admin'] },
  ] as const;

  return (
    <div className="flex items-center gap-2">
      {navItems
        .filter((item) => !user || item.roles.includes(user.role))
        .map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Button
              key={item.href}
              asChild
              variant={isActive ? 'default' : 'outline'}
              className={cn(
                'shadow-sm',
                isActive && 'bg-blue-600 hover:bg-blue-700 text-white'
              )}
            >
              <Link to={item.href} className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            </Button>
          );
        })}
    </div>
  );
}
