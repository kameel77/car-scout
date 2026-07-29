import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    MessageSquare,
    Languages,
    Users,
    HelpCircle,
    Search,
    ChevronLeft,
    ChevronRight,
    UserCircle,
    Banknote,
    Upload,
    BarChart3,
    Car,
    Handshake,
    ClipboardList,
    Building2,
    FileSpreadsheet,
    Network,
    Store,
    Settings,
    Shield,
    FileText,
    Blocks,
    LayoutGrid,
    Images,
    FileEdit,
    Target,
} from 'lucide-react';
import { useAuth, MemberRole, ROLE_LABELS } from '@/contexts/AuthContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useBrand } from '@/contexts/BrandContext';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Defines which MemberRoles can see each nav item.
 * Platform roles see everything, others are filtered.
 */
type NavItem = {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Minimum role level required (lower index = higher privilege) */
    visibleTo: MemberRole[];
    dividerBefore?: boolean;
};

const ALL_ROLES: MemberRole[] = [
    'SUPERADMIN_PLATFORM',
    'PLATFORM_MANAGER',
    'DEALER_GROUP_ADMIN',
    'DEALER_ADMIN',
    'DEALER_EMPLOYEE',
];

const PLATFORM_ONLY: MemberRole[] = ['SUPERADMIN_PLATFORM', 'PLATFORM_MANAGER'];
const ADMIN_AND_UP: MemberRole[] = ['SUPERADMIN_PLATFORM', 'PLATFORM_MANAGER', 'DEALER_GROUP_ADMIN', 'DEALER_ADMIN'];
const STOCK_ACCESS: MemberRole[] = ALL_ROLES;

const NAV_ITEMS: NavItem[] = [
    // Dashboard – everyone
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, visibleTo: ALL_ROLES },
    { href: '/admin/leads', label: 'Leady', icon: MessageSquare, visibleTo: ALL_ROLES },

    // Stock management – everyone with stock access
    { href: '/admin/listings', label: 'Pojazdy', icon: Car, visibleTo: STOCK_ACCESS },
    { href: '/admin/specifications', label: 'Specyfikacje', icon: FileText, visibleTo: STOCK_ACCESS },
    { href: '/admin/import', label: 'Import', icon: Upload, visibleTo: STOCK_ACCESS },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, visibleTo: PLATFORM_ONLY },

    // Rental – admin and up
    { href: '/admin/rental-vehicles', label: 'Pojazdy najmu', icon: ClipboardList, visibleTo: STOCK_ACCESS, dividerBefore: true },
    { href: '/admin/rental-companies', label: 'Firmy najmowe', icon: Building2, visibleTo: PLATFORM_ONLY },
    { href: '/admin/rental-matrix', label: 'Matryca najmu', icon: FileSpreadsheet, visibleTo: PLATFORM_ONLY },

    // Platform admin only
    { href: '/admin/dealer-groups', label: 'Grupy dealerskie', icon: Network, visibleTo: PLATFORM_ONLY, dividerBefore: true },
    { href: '/admin/dealers', label: 'Dealerzy', icon: Store, visibleTo: [...PLATFORM_ONLY, 'DEALER_GROUP_ADMIN'] },

    // Users – admin levels
    { href: '/admin/users', label: 'Użytkownicy', icon: Users, visibleTo: ADMIN_AND_UP, dividerBefore: true },

    // Platform settings
    { href: '/admin/translations', label: 'Tłumaczenia', icon: Languages, visibleTo: PLATFORM_ONLY, dividerBefore: true },
    { href: '/admin/financing', label: 'Finansowanie', icon: Banknote, visibleTo: PLATFORM_ONLY },
    { href: '/admin/seo', label: 'SEO', icon: Search, visibleTo: PLATFORM_ONLY },
    { href: '/admin/faq', label: 'FAQ', icon: HelpCircle, visibleTo: PLATFORM_ONLY },
    { href: '/admin/seo-content', label: 'Treści SEO', icon: FileEdit, visibleTo: PLATFORM_ONLY },
    { href: '/admin/partners', label: 'Reklamy partnerskie', icon: Handshake, visibleTo: PLATFORM_ONLY },
    { href: '/admin/api-partners', label: 'Klucze API', icon: Network, visibleTo: PLATFORM_ONLY },
    { href: '/admin/widgets', label: 'Widgety', icon: Blocks, visibleTo: PLATFORM_ONLY },
    { href: '/admin/feature-tiles', label: 'Kafle home', icon: LayoutGrid, visibleTo: PLATFORM_ONLY },
    { href: '/admin/hero-banners', label: 'Banery hero', icon: Images, visibleTo: PLATFORM_ONLY },
    { href: '/admin/landing-pages', label: 'Landing Pages', icon: Target, visibleTo: PLATFORM_ONLY },
];

export function AdminSidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();
    const { user, effectiveRole, activeContext, isPlatformUser } = useAuth();
    const { data: settings } = useAppSettings();
    const { config } = useBrand();
    const { i18n } = useTranslation();

    const siteName = React.useMemo(() => {
        if (!settings) return config.name;
        const lang = i18n.language.slice(0, 2).toLowerCase();
        const candidates = [
            lang === 'en' ? settings?.siteNameEn : null,
            lang === 'de' ? settings?.siteNameDe : null,
            lang === 'pl' ? settings?.siteNamePl : null,
            settings?.siteNameEn,
            settings?.siteNameDe,
            settings?.siteNamePl
        ];
        const pick = candidates.find((s) => typeof s === 'string' && s.trim().length > 0);
        return pick?.trim() || config.name;
    }, [i18n.language, settings?.siteNameEn, settings?.siteNameDe, settings?.siteNamePl, settings, config.name]);

    const initial = siteName.charAt(0).toUpperCase();
    const initials = siteName.split(' ').map(s => s.charAt(0)).join('').toUpperCase().slice(0, 2);

    // Filter nav items by effective role
    const filteredItems = NAV_ITEMS.filter(item => {
        if (!effectiveRole) {
            // Fallback to legacy role check
            const legacyRole = user?.role;
            if (legacyRole === 'admin') return true;
            if (legacyRole === 'manager') {
                return !item.visibleTo.every(r => PLATFORM_ONLY.includes(r) && r !== 'PLATFORM_MANAGER');
            }
            return false;
        }
        return item.visibleTo.includes(effectiveRole);
    });

    // Context display
    const contextLabel = activeContext?.label
        || (activeContext?.scopeType === 'PLATFORM' ? 'Platforma'
            : activeContext?.scopeType === 'DEALER_GROUP' ? 'Grupa'
                : 'Dealer');

    const roleLabel = effectiveRole ? ROLE_LABELS[effectiveRole] : user?.role || '';

    return (
        <motion.div
            initial={false}
            animate={{ width: isCollapsed ? '80px' : '280px' }}
            className={cn(
                "relative flex flex-col h-screen bg-white border-r shadow-lg transition-all duration-300 ease-in-out z-50"
            )}
        >
            {/* Sidebar Header */}
            <div className="h-20 flex items-center justify-between px-6 border-b shrink-0">
                <AnimatePresence mode="wait">
                    {!isCollapsed && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex items-center gap-2"
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
                                {initials.length > 0 ? initial : 'C'}
                            </div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
                                {siteName}
                            </h2>
                        </motion.div>
                    )}
                    {isCollapsed && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className="mx-auto"
                        >
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
                                {initials || 'CS'}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Context Badge (only for platform users or when not platform scope) */}
            {!isCollapsed && activeContext?.scopeType !== 'PLATFORM' && (
                <div className="mx-4 mt-3 p-2.5 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-500 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-blue-700 truncate">{contextLabel}</p>
                            <p className="text-[10px] text-blue-500 truncate">
                                {activeContext.scopeType === 'DEALER_GROUP' ? 'Grupa dealerska' : 'Dealer'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
                {filteredItems.map((item, idx) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;
                    const showDivider = item.dividerBefore && idx > 0;

                    return (
                        <React.Fragment key={item.href}>
                            {showDivider && (
                                <div className="my-2 border-t border-gray-100" />
                            )}
                            <Link to={item.href} className="block">
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start gap-4 h-11 rounded-xl transition-all duration-200 group relative",
                                        isActive
                                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
                                        isCollapsed && "justify-center px-0"
                                    )}
                                >
                                    <div className={cn(
                                        "relative flex items-center justify-center min-w-[24px]",
                                        isActive && "scale-110 transition-transform"
                                    )}>
                                        <Icon className="w-5 h-5 shrink-0" />
                                    </div>
                                    {!isCollapsed && (
                                        <motion.span
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="font-medium truncate text-sm"
                                        >
                                            {item.label}
                                        </motion.span>
                                    )}

                                    {/* Active Indicator */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="active-nav"
                                            className="absolute left-0 w-1 h-8 bg-blue-600 rounded-r-full"
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        />
                                    )}
                                </Button>
                            </Link>
                        </React.Fragment>
                    );
                })}
            </div>

            {/* User Info & Collapse Toggle */}
            <div className="p-4 border-t space-y-3 bg-gray-50/50">
                {!isCollapsed && user && (
                    <div className="flex items-center gap-3 px-2 py-1">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <UserCircle className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{user.name || user.email}</p>
                            <p className="text-xs text-gray-500 truncate">{roleLabel}</p>
                        </div>
                    </div>
                )}

                <Button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    variant="outline"
                    size="icon"
                    className={cn(
                        "w-full h-10 border-gray-200 hover:bg-white hover:border-blue-400 transition-colors",
                        isCollapsed && "px-0"
                    )}
                >
                    {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                    ) : (
                        <div className="flex items-center gap-2">
                            <ChevronLeft className="w-4 h-4 text-gray-500" />
                            <span className="text-xs font-medium text-gray-500">Zwiń sidebar</span>
                        </div>
                    )}
                </Button>
            </div>
        </motion.div>
    );
}
