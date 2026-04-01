import { Navigate } from 'react-router-dom';
import { useAuth, MemberRole } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    /** Optional: restrict to specific minimum roles */
    requiredPermission?: string;
}

/**
 * Role hierarchy for checking access.
 * Higher index = more restrictive.
 */
const ROLE_HIERARCHY: MemberRole[] = [
    'SUPERADMIN_PLATFORM',
    'PLATFORM_MANAGER',
    'DEALER_GROUP_ADMIN',
    'DEALER_ADMIN',
    'DEALER_EMPLOYEE',
];

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
    const { user, isLoading, effectiveRole } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/admin/login" replace />;
    }

    // If no specific permission is required, just check authentication
    if (!requiredPermission) {
        return <>{children}</>;
    }

    // For now, all authenticated users can access — 
    // specific permission checks will be added per-page in Etap 3
    return <>{children}</>;
}
