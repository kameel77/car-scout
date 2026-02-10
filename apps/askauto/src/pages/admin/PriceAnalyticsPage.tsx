import { PriceAnalyticsDashboard } from '@/components/admin/PriceAnalyticsDashboard';
import { BarChart3 } from 'lucide-react';

export default function PriceAnalyticsPage() {
    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Price Analytics
                </h1>
                <p className="text-gray-600">
                    Analizuj trendy i zmiany cen na rynku.
                </p>
            </div>

            {/* Analytics Section */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold">Price Analytics</h2>
                </div>
                <PriceAnalyticsDashboard />
            </section>
        </div>
    );
}
