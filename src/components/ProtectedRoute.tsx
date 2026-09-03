import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, Permission } from '@/contexts/AuthContext';
import { getLoginRedirectPath } from '@/utils/authRedirect';

interface Props {
    children: React.ReactNode;
    /**
     * Permission required to access this route.
     * Omit it only for routes every authenticated admin user may open (e.g. the dashboard).
     *
     * Do NOT reintroduce role-based props here. Roles are not a linear hierarchy:
     * CONTENT_MANAGER_PLATFORM sits next to PLATFORM_MANAGER, not below it.
     * Authorization is permission-based, and the API remains the source of truth —
     * this guard only decides what gets rendered.
     */
    permission?: Permission;
}

export function ProtectedRoute({ children, permission }: Props) {
  const { user, isLoading, can } = useAuth();
  const location = useLocation();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (!user) {
      return <Navigate to={getLoginRedirectPath(location)} replace />;
    }

    if (permission && !can(permission)) {
        return <Navigate to="/admin/dashboard" replace />;
    }

    return <>{children}</>;
}
