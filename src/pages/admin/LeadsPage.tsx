import { LeadList } from '@/components/admin/LeadList';
import { MessageSquare } from 'lucide-react';

export default function LeadsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
                    <MessageSquare className="w-8 h-8 text-blue-600" />
                    Leady
                </h1>
                <p className="text-gray-600">
                    Zarządzaj zapytaniami klientów z formularzy kontaktowych.
                </p>
            </div>
            <LeadList />
        </div>
    );
}
