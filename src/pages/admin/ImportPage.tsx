import { CSVUploader } from '@/components/admin/CSVUploader';
import { CSFlowImporter } from '@/components/admin/CSFlowImporter';
import { CSFlowSourcesManager } from '@/components/admin/CSFlowSourcesManager';
import { ImportHistory } from '@/components/admin/ImportHistory';
import { BulkSourceManager } from '@/components/admin/BulkSourceManager';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, History, Database } from 'lucide-react';

export default function ImportPage() {
    const { can } = useAuth();

    // Feed sources and bulk operations by source are platform-wide configuration
    // (and destructive) — they stay with the superadmin, unlike ordinary CSV import.
    const canManageSources = can('stock:sources:write');

    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Import
                </h1>
                <p className="text-gray-600">
                    Importuj dane ofert z plików CSV i przeglądaj historię.
                </p>
            </div>

            {can('stock:import') && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Upload className="w-5 h-5 text-blue-600" />
                        <h2 className="text-xl font-semibold">Dane Pojazdów</h2>
                    </div>
                    <div>
                        {canManageSources && (
                            <>
                                <CSFlowImporter />
                                <CSFlowSourcesManager />
                            </>
                        )}
                        <CSVUploader />
                    </div>
                </section>
            )}

            {/* Bulk source management */}
            {canManageSources && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Database className="w-5 h-5 text-rose-500" />
                        <h2 className="text-xl font-semibold">Zarządzanie wg źródła</h2>
                    </div>
                    <BulkSourceManager />
                </section>
            )}

            {/* Import History Section */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <History className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold">Import History</h2>
                </div>
                <ImportHistory />
            </section>
        </div>
    );
}
