import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Eye, Target, Percent, Globe, Calendar, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { analyticsApi } from '@/services/api';
import { Button } from '@/components/ui/button';

interface TelemetryData {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  totals: {
    pageViews: number;
    leadsSubmitted: number;
    employerB2BViews: number;
    employerB2BLeads: number;
    b2bConversionRatePercent: number;
  };
  pathBreakdown: Array<{
    path: string;
    views: number;
    events: number;
  }>;
  eventsBreakdown: Array<{
    eventName: string;
    count: number;
  }>;
  dailyTimeline: Array<{
    date: string;
    views: number;
    leads: number;
    b2bViews: number;
    b2bLeads: number;
  }>;
}

export const TelemetryDashboard: React.FC = () => {
  const [days, setDays] = useState(7);
  const { token } = useAuth();

  const { data, isLoading, refetch, isFetching } = useQuery<TelemetryData>({
    queryKey: ['telemetry-summary', days],
    queryFn: async () => {
      if (!token) throw new Error('Brak tokenu autoryzacji');
      return analyticsApi.getTelemetrySummary(days, token);
    },
    enabled: !!token,
    refetchInterval: 60000 // Refresh every 60s
  });

  const totals = data?.totals || {
    pageViews: 0,
    leadsSubmitted: 0,
    employerB2BViews: 0,
    employerB2BLeads: 0,
    b2bConversionRatePercent: 0
  };

  const pathBreakdown = data?.pathBreakdown || [];
  const dailyTimeline = data?.dailyTimeline || [];

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Telemetria Cookieless & Konwersja B2B (Benefivo)
          </h3>
          <p className="text-sm text-gray-500">
            Anonimowe zdarzenia z portalu pracowniczego i landing page benefivo.pl
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={days.toString()} onValueChange={(val) => setDays(Number(val))}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue placeholder="Wybierz okres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Ostatnie 7 dni</SelectItem>
              <SelectItem value="14">Ostatnie 14 dni</SelectItem>
              <SelectItem value="30">Ostatnie 30 dni</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="bg-white"
            title="Odśwież dane"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-blue-600' : 'text-gray-600'}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Wszystkie Odsłony
            </CardTitle>
            <Eye className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {isLoading ? '...' : totals.pageViews.toLocaleString('pl-PL')}
            </div>
            <p className="text-xs text-gray-500 mt-1">Zdarzenia page_view</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Odwiedziny /dla-firm
            </CardTitle>
            <Users className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {isLoading ? '...' : totals.employerB2BViews.toLocaleString('pl-PL')}
            </div>
            <p className="text-xs text-gray-500 mt-1">Ruch pracodawców B2B</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Wysłane Leady B2B
            </CardTitle>
            <Target className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {isLoading ? '...' : totals.employerB2BLeads.toLocaleString('pl-PL')}
            </div>
            <p className="text-xs text-gray-500 mt-1">Zgłoszenia pracodawców CRM</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Konwersja B2B
            </CardTitle>
            <Percent className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {isLoading ? '...' : `${totals.b2bConversionRatePercent}%`}
            </div>
            <p className="text-xs text-gray-500 mt-1">Wysłane / Odwiedziny /dla-firm</p>
          </CardContent>
        </Card>
      </div>

      {/* Path Breakdown Table */}
      <Card className="bg-white border-gray-200 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            Odsłony i Zdarzenia według Ścieżek
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pathBreakdown.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              Brak zarejestrowanych odsłon w wybranym okresie.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ścieżka URL</th>
                    <th className="px-4 py-3 font-medium text-right">Odsłony (Views)</th>
                    <th className="px-4 py-3 font-medium text-right">Wszystkie Zdarzenia</th>
                    <th className="px-4 py-3 font-medium text-right">Udział w ruchu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pathBreakdown.map((row) => {
                    const share = totals.pageViews > 0
                      ? ((row.views / totals.pageViews) * 100).toFixed(1)
                      : '0.0';

                    return (
                      <tr key={row.path} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-900 font-medium">
                          {row.path}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {row.views.toLocaleString('pl-PL')}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {row.events.toLocaleString('pl-PL')}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {share}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Breakdown Table */}
      {dailyTimeline.length > 0 && (
        <Card className="bg-white border-gray-200 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              Oś czasu (Dzień po dniu)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium text-right">Łączne Odsłony</th>
                    <th className="px-4 py-3 font-medium text-right">Wizyty /dla-firm</th>
                    <th className="px-4 py-3 font-medium text-right">Leady B2B</th>
                    <th className="px-4 py-3 font-medium text-right">Konwersja Dnia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dailyTimeline.map((day) => {
                    const conv = day.b2bViews > 0
                      ? `${((day.b2bLeads / day.b2bViews) * 100).toFixed(1)}%`
                      : '-';

                    return (
                      <tr key={day.date} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {day.date}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {day.views.toLocaleString('pl-PL')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {day.b2bViews.toLocaleString('pl-PL')}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-purple-600">
                          {day.b2bLeads}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {conv}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
