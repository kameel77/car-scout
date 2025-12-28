import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingDown, TrendingUp, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { analyticsApi } from '@/services/api';

export function PriceAnalyticsDashboard() {
    const [days, setDays] = useState(30);
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const { token } = useAuth();

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['price-trends', days, make, model],
        queryFn: async () => {
            if (!token) throw new Error('No token');
            return analyticsApi.getPriceTrends({ days, make, model }, token);
        },
        enabled: !!token,
        refetchInterval: 300000 // Refresh every 5 minutes
    });

    useEffect(() => {
        refetch();
    }, [days, make, model, refetch]);

    if (isLoading) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { trends = [], priceChanges = [], config } = data || {};

    return (
        <div className="space-y-6">
            {/* Price Trend Chart */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="w-5 h-5" />
                            Average Price Trend
                        </CardTitle>

                        {/* UI Controls */}
                        <div className="flex gap-2">
                            <Select
                                value={days.toString()}
                                onValueChange={(v) => setDays(parseInt(v))}
                            >
                                <SelectTrigger className="w-36">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7">Last 7 days</SelectItem>
                                    <SelectItem value="14">Last 14 days</SelectItem>
                                    <SelectItem value="30">Last 30 days</SelectItem>
                                    <SelectItem value="60">Last 60 days</SelectItem>
                                    <SelectItem value="90">Last 90 days</SelectItem>
                                    <SelectItem value="180">Last 6 months</SelectItem>
                                    <SelectItem value="365">Last year</SelectItem>
                                </SelectContent>
                            </Select>

                            <Input
                                placeholder="Make (e.g. Toyota)"
                                value={make}
                                onChange={(e) => setMake(e.target.value)}
                                className="w-40"
                            />

                            <Input
                                placeholder="Model (e.g. Corolla)"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-40"
                            />
                        </div>
                    </div>
                    {config && (
                        <p className="text-sm text-muted-foreground">
                            Showing {config.days} days, grouped by {config.groupBy}
                            {config.filters.make && ` • ${config.filters.make}`}
                            {config.filters.model && ` ${config.filters.model}`}
                        </p>
                    )}
                </CardHeader>
                <CardContent>
                    {trends.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={trends}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Line
                                    type="monotone"
                                    dataKey="avg_price"
                                    stroke="#2563eb"
                                    strokeWidth={2}
                                    name="Avg Price (PLN)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            No data available for selected filters
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recent Price Changes */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Price Changes</CardTitle>
                </CardHeader>
                <CardContent>
                    {priceChanges.length > 0 ? (
                        <div className="space-y-3">
                            {priceChanges.slice(0, 10).map((change: any, index: number) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex-1">
                                        <p className="font-semibold">
                                            {change.make} {change.model}
                                        </p>
                                        <p className="text-sm text-gray-600">VIN: {change.vin}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600 line-through">
                                                {change.old_price?.toLocaleString()} PLN
                                            </p>
                                            <p className="font-bold">
                                                {change.new_price?.toLocaleString()} PLN
                                            </p>
                                        </div>
                                        <div className={`flex items-center gap-1 ${change.change_percent < 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {change.change_percent < 0 ? (
                                                <TrendingDown className="w-5 h-5" />
                                            ) : (
                                                <TrendingUp className="w-5 h-5" />
                                            )}
                                            <span className="font-bold">
                                                {Math.abs(change.change_percent)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            No price changes in selected period
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
