import { useState } from 'react';
import { PriceAnalyticsDashboard } from '@/components/admin/PriceAnalyticsDashboard';
import { TelemetryDashboard } from '@/components/admin/TelemetryDashboard';
import { BarChart3, Activity } from 'lucide-react';

export default function PriceAnalyticsPage() {
    const [activeTab, setActiveTab] = useState<'telemetry' | 'prices'>('telemetry');

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Analityka & Wyniki
                </h1>
                <p className="text-gray-600">
                    Analizuj trendy cenowe na rynku oraz telemetrię i konwersję portalu Benefivo.
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200">
                <button
                    type="button"
                    onClick={() => setActiveTab('telemetry')}
                    className={`flex items-center gap-2 py-3 px-5 border-b-2 font-medium text-sm transition-colors cursor-pointer ${
                        activeTab === 'telemetry'
                            ? 'border-blue-600 text-blue-600 font-semibold'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <Activity className="w-4 h-4" />
                    Telemetria & Konwersja B2B (Benefivo)
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('prices')}
                    className={`flex items-center gap-2 py-3 px-5 border-b-2 font-medium text-sm transition-colors cursor-pointer ${
                        activeTab === 'prices'
                            ? 'border-blue-600 text-blue-600 font-semibold'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <BarChart3 className="w-4 h-4" />
                    Trendy Cenowe
                </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'telemetry' ? (
                <section>
                    <TelemetryDashboard />
                </section>
            ) : (
                <section>
                    <PriceAnalyticsDashboard />
                </section>
            )}
        </div>
    );
}
