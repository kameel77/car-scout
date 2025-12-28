import { CSVUploader } from '@/components/admin/CSVUploader';
import { ImportHistory } from '@/components/admin/ImportHistory';
import { PriceAnalyticsDashboard } from '@/components/admin/PriceAnalyticsDashboard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, BarChart3, Upload, History } from 'lucide-react';

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header */}
            <header className="bg-white border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Car Scout Admin
                            </h1>
                            <p className="text-sm text-gray-600">
                                Welcome back, {user?.name || user?.email}
                            </p>
                        </div>
                        <Button onClick={handleLogout} variant="outline">
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-8">
                    {/* CSV Upload Section */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <Upload className="w-5 h-5 text-blue-600" />
                            <h2 className="text-xl font-semibold">CSV Import</h2>
                        </div>
                        <CSVUploader />
                    </section>

                    {/* Import History Section */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <History className="w-5 h-5 text-blue-600" />
                            <h2 className="text-xl font-semibold">Import History</h2>
                        </div>
                        <ImportHistory />
                    </section>

                    {/* Analytics Section */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                            <h2 className="text-xl font-semibold">Price Analytics</h2>
                        </div>
                        <PriceAnalyticsDashboard />
                    </section>
                </div>
            </main>
        </div>
    );
}
