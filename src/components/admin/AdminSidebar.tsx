import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    Languages,
    Users,
    HelpCircle,
    Search,
    ChevronLeft,
    ChevronRight,
    UserCircle,
    Banknote
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export function AdminSidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();
    const { user } = useAuth();

    const navItems = [
        { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager'] },
        { href: '/admin/translations', label: 'Translations', icon: Languages, roles: ['admin', 'manager'] },
        { href: '/admin/financing', label: 'Finansowanie', icon: Banknote, roles: ['admin', 'manager'] },
        { href: '/admin/seo', label: 'SEO', icon: Search, roles: ['admin', 'manager'] },
        { href: '/admin/faq', label: 'FAQ', icon: HelpCircle, roles: ['admin', 'manager'] },
        { href: '/admin/users', label: 'Users', icon: Users, roles: ['admin'] },
    ] as const;

    const filteredItems = navItems.filter(
        (item) => !user || (item.roles as readonly string[]).includes(user.role)
    );

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
                                C
                            </div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
                                Car Scout
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
                                CS
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
                {filteredItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link key={item.href} to={item.href} className="block">
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-4 h-12 rounded-xl transition-all duration-200 group relative",
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
                                        className="font-medium truncate"
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
                    );
                })}
            </div>

            {/* User Info & Collapse Toggle */}
            <div className="p-4 border-t space-y-4 bg-gray-50/50">
                {!isCollapsed && user && (
                    <div className="flex items-center gap-3 px-2 py-1">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <UserCircle className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{user.name || user.email}</p>
                            <p className="text-xs text-gray-500 truncate capitalize">{user.role}</p>
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
