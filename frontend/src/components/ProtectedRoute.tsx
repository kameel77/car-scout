import { Navigate } from 'react-router-dom';
import { useAuth, MemberRole } from '@/contexts/AuthContext';

interface Props {
    children: React.ReactNode;
    /** Legacy: allowed roles by User.role string */
    allowedRoles?: string[];
    /** New: minimum effective MemberRole required */
    minRole?: MemberRole;
}

/**
 * Role hierarchy — lower index = higher privilege.
 */
const ROLE_HIERARCHY: MemberRole[] = [
    'SUPERADMIN_PLATFORM',
    'PLATFORM_MANAGER',
    'DEALER_GROUP_ADMIN',
    'DEALER_ADMIN',
    'DEALER_EMPLOYEE',
];

function roleAtLeast(currentRole: MemberRole | null, minRole: MemberRole): boolean {
    if (!currentRole) return false;
    const curIdx = ROLE_HIERARCHY.indexOf(currentRole);
    const minIdx = ROLE_HIERARCHY.indexOf(minRole);
    return curIdx >= 0 && curIdx <= minIdx;
}

export function ProtectedRoute({ children, allowedRoles, minRole }: Props) {
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

    // New role-based check
    if (minRole) {
        if (!roleAtLeast(effectiveRole, minRole)) {
            return <Navigate to="/admin/dashboard" replace />;
        }
        return <>{children}</>;
    }

    // Legacy role-based check (backward compat)
    if (allowedRoles) {
        // Map new effective roles to legacy strings for backward compat
        const legacyRole = user.role;
        const effectiveLegacy = effectiveRole === 'SUPERADMIN_PLATFORM' ? 'admin'
            : effectiveRole === 'PLATFORM_MANAGER' ? 'manager'
                : effectiveRole === 'DEALER_GROUP_ADMIN' ? 'manager'
                    : effectiveRole === 'DEALER_ADMIN' ? 'manager'
                        : effectiveRole === 'DEALER_EMPLOYEE' ? 'manager'
                            : legacyRole;

        if (!allowedRoles.includes(effectiveLegacy) && !allowedRoles.includes(legacyRole)) {
            return <Navigate to="/admin/dashboard" replace />;
        }
    }

    return <>{children}</>;
}
