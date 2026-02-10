import { LeadList } from '@/components/admin/LeadList';
import { SettingsModule } from '@/components/admin/SettingsModule';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Settings } from 'lucide-react';

export default function AdminDashboard() {
    const { user } = useAuth();
    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Dashboard
                </h1>
                <p className="text-gray-600">
                    Zarządzaj danymi i analizuj wyniki.
                </p>
            </div>
            {/* Settings Section (Admin only) */}
            {user?.role === 'admin' && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Settings className="w-5 h-5 text-blue-600" />
                        <h2 className="text-xl font-semibold">Ustawienia Platformy</h2>
                    </div>
                    <SettingsModule />
                </section>
            )}

            {/* Lead Management Section */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold">Lead Management</h2>
                </div>
                <LeadList />
            </section>
        </div>
    );
}
