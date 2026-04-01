import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { importApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export function CSFlowImporter() {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{
        status: 'idle' | 'success' | 'error';
        message: string;
        details?: any;
    }>({ status: 'idle', message: '' });

    const handleSync = async () => {
        if (!token) return;

        setIsLoading(true);
        setResult({ status: 'idle', message: '' });

        try {
            const response = await importApi.syncCSFlow(token);
            setResult({
                status: 'success',
                message: 'Pomyślnie zsynchronizowano z CSFlow',
                details: response.result
            });
            
            // Reload statystyk po chwili
            setTimeout(() => {
                window.location.reload();
            }, 2500);

        } catch (error) {
            console.error('Błąd synchronizacji CSFlow:', error);
            setResult({
                status: 'error',
                message: error instanceof Error ? error.message : 'Wystąpił błąd podczas połączenia z API CSFlow'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Synchronizacja CSFlow</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Pobiera nowe i aktualizuje istniejące oferty bezpośrednio przez integrację z CSFlow WebAPI. System chroni przed duplikatami poprzez weryfikację VIN.
                    </p>
                </div>
                
                <Button 
                    onClick={handleSync} 
                    disabled={isLoading}
                    className="shrink-0"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    {isLoading ? 'Pobieranie...' : 'Pobierz teraz z CSFlow'}
                </Button>
            </div>

            {result.status !== 'idle' && (
                <div className={`mt-4 p-4 rounded-md flex items-start ${
                    result.status === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                    {result.status === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 mr-2 shrink-0 text-green-500" />
                    ) : (
                        <AlertCircle className="w-5 h-5 mr-2 shrink-0 text-red-500" />
                    )}
                    <div>
                        <p className="font-medium">{result.message}</p>
                        {result.status === 'success' && result.details && (
                            <ul className="mt-2 text-sm text-green-700 space-y-1">
                                <li>Dodano: <strong>{result.details.inserted}</strong></li>
                                <li>Zaktualizowano: <strong>{result.details.updated}</strong></li>
                                <li>Zarchiwizowano: <strong>{result.details.archived}</strong></li>
                                <li>Pominięto (błędy/duplikaty VIN): <strong>{result.details.failed}</strong></li>
                                <li>Zlecono przeładowanie wyników...</li>
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
