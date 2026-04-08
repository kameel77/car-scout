import { Outlet, useNavigate } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { ContextSwitcher } from './ContextSwitcher';
import { Button } from '@/components/ui/button';
import { LogOut, Globe } from 'lucide-react';
import { useAuth, ROLE_LABELS } from '@/contexts/AuthContext';

export default function AdminLayout() {
    const { logout, effectiveRole, isPlatformUser, canSwitchContext, activeContext } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    const roleLabel = effectiveRole ? ROLE_LABELS[effectiveRole] : '';

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            {/* Sidebar */}
            <AdminSidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="h-20 bg-white border-b flex items-center justify-between px-8 shrink-0 z-40">
                    <div className="flex items-center gap-4">
                        {/* Context switcher for platform users */}
                        {canSwitchContext && <ContextSwitcher />}

                        {/* Show current context for non-platform users */}
                        {!isPlatformUser && activeContext?.scopeType !== 'PLATFORM' && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-sm">
                                <Globe className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">{activeContext?.label || 'Kontekst'}</span>
                                <span className="text-gray-400">·</span>
                                <span className="text-gray-500 font-medium">{roleLabel}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <Button
                            onClick={handleLogout}
                            variant="outline"
                            className="rounded-xl border-gray-200 hover:bg-gray-50 hover:text-red-600 hover:border-red-200 transition-all duration-200"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Wyloguj
                        </Button>
                    </div>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
