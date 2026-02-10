import { CSVUploader } from '@/components/admin/CSVUploader';
import { ImportHistory } from '@/components/admin/ImportHistory';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, History } from 'lucide-react';

export default function ImportPage() {
    const { user } = useAuth();

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

            {/* CSV Upload Section (Admin only) */}
            {user?.role === 'admin' && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Upload className="w-5 h-5 text-blue-600" />
                        <h2 className="text-xl font-semibold">CSV Import</h2>
                    </div>
                    <CSVUploader />
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
