import { useEffect, useState } from 'react';
import { History, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { importApi } from '@/services/api';

interface ImportLog {
    id: string;
    fileName: string;
    totalRows: number;
    inserted: number;
    updated: number;
    archived: number;
    failed: number;
    status: string;
    importedAt: string;
    duration: number;
    user: {
        email: string;
        name: string | null;
    };
}

export function ImportHistory() {
    const [logs, setLogs] = useState<ImportLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { token } = useAuth();

    useEffect(() => {
        const fetchHistory = async () => {
            if (!token) return;

            try {
                const { logs: importLogs } = await importApi.getHistory(token);
                setLogs(importLogs);
            } catch (error) {
                console.error('Failed to fetch import history:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [token]);

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

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Import History
                </CardTitle>
            </CardHeader>
            <CardContent>
                {logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No imports yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {logs.map((log) => (
                            <div
                                key={log.id}
                                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            {log.status === 'success' ? (
                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-red-600" />
                                            )}
                                            <span className="font-semibold">{log.fileName}</span>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-2">
                                            <div>
                                                <span className="text-gray-600">Total:</span>
                                                <span className="ml-1 font-semibold">{log.totalRows}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Inserted:</span>
                                                <span className="ml-1 font-semibold text-green-600">{log.inserted}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Updated:</span>
                                                <span className="ml-1 font-semibold text-blue-600">{log.updated}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Archived:</span>
                                                <span className="ml-1 font-semibold text-orange-600">{log.archived}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(log.importedAt).toLocaleString()}
                                            </div>
                                            <div>
                                                Duration: {(log.duration / 1000).toFixed(2)}s
                                            </div>
                                            <div>
                                                By: {log.user.name || log.user.email}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
