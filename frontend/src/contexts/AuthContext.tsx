import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';

// ==========================================
// Multi-tenant types
// ==========================================

export type ScopeType = 'PLATFORM' | 'DEALER_GROUP' | 'DEALER';

export type MemberRole =
    | 'SUPERADMIN_PLATFORM'
    | 'PLATFORM_MANAGER'
    | 'DEALER_GROUP_ADMIN'
    | 'DEALER_ADMIN'
    | 'DEALER_EMPLOYEE';

export interface MembershipInfo {
    id: string;
    scopeType: ScopeType;
    scopeId: string;
    role: MemberRole;
    isDefaultContext: boolean;
}

export interface ActiveContext {
    scopeType: ScopeType;
    scopeId: string;
    label?: string;
}

interface User {
    id: string;
    email: string;
    name: string | null;
    phone?: string | null;
    role: string; // legacy
    memberships?: MembershipInfo[];
    activeContext?: ActiveContext;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    switchContext: (scopeType: ScopeType, scopeId: string, label?: string) => Promise<boolean>;
    isLoading: boolean;
    // Computed helpers
    effectiveRole: MemberRole | null;
    isPlatformUser: boolean;
    isGroupAdmin: boolean;
    isDealerLevel: boolean;
    canSwitchContext: boolean;
    activeContext: ActiveContext;
}

const DEFAULT_CONTEXT: ActiveContext = { scopeType: 'PLATFORM', scopeId: 'PLATFORM', label: 'Platforma' };

const PLATFORM_ROLES = new Set<MemberRole>(['SUPERADMIN_PLATFORM', 'PLATFORM_MANAGER']);

const ROLE_PRIORITY: MemberRole[] = [
    'SUPERADMIN_PLATFORM',
    'PLATFORM_MANAGER',
    'DEALER_GROUP_ADMIN',
    'DEALER_ADMIN',
    'DEALER_EMPLOYEE',
];

export const ROLE_LABELS: Record<MemberRole, string> = {
    SUPERADMIN_PLATFORM: 'Superadmin',
    PLATFORM_MANAGER: 'Manager',
    DEALER_GROUP_ADMIN: 'Admin grupy',
    DEALER_ADMIN: 'Admin dealera',
    DEALER_EMPLOYEE: 'Pracownik',
};

function computeEffectiveRole(memberships: MembershipInfo[], ctx: ActiveContext): MemberRole | null {
    const matching = memberships.filter(m => {
        if (m.scopeType === 'PLATFORM' && m.scopeId === 'PLATFORM') return true;
        if (m.scopeType === ctx.scopeType && m.scopeId === ctx.scopeId) return true;
        return false;
    });
    const roles = new Set(matching.map(m => m.role));
    for (const role of ROLE_PRIORITY) {
        if (roles.has(role)) return role;
    }
    return null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(
        localStorage.getItem('auth_token')
    );
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const verifyToken = async () => {
            if (token) {
                try {
                    const { user } = await authApi.me(token);
                    // Restore saved context label from localStorage
                    const savedLabel = localStorage.getItem('context_label');
                    if (savedLabel && user?.activeContext) {
                        user.activeContext.label = savedLabel;
                    }
                    setUser(user);
                } catch (error) {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('context_label');
                    setToken(null);
                }
            }
            setIsLoading(false);
        };

        verifyToken();
    }, [token]);

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            const { token: newToken, user: newUser } = await authApi.login(email, password);
            localStorage.setItem('auth_token', newToken);
            localStorage.removeItem('context_label');
            setToken(newToken);
            setUser(newUser);
            return true;
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('context_label');
        setToken(null);
        setUser(null);
    };

    const switchContext = useCallback(async (scopeType: ScopeType, scopeId: string, label?: string): Promise<boolean> => {
        if (!token) return false;

        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
            const cleanBase = API_BASE_URL.replace(/\/api\/?$/, '');

            const response = await fetch(`${cleanBase}/api/auth/context`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ scopeType, scopeId }),
            });

            if (!response.ok) return false;

            const data = await response.json();
            localStorage.setItem('auth_token', data.token);
            if (label) {
                localStorage.setItem('context_label', label);
            } else {
                localStorage.removeItem('context_label');
            }
            setToken(data.token);

            setUser(prev => prev ? {
                ...prev,
                activeContext: { ...data.activeContext, label },
            } : null);
            return true;
        } catch (error) {
            console.error('Context switch failed:', error);
            return false;
        }
    }, [token]);

    // Computed values
    const memberships = user?.memberships || [];
    const activeContext = user?.activeContext || DEFAULT_CONTEXT;
    const effectiveRole = computeEffectiveRole(memberships, activeContext);
    const isPlatformUser = effectiveRole !== null && PLATFORM_ROLES.has(effectiveRole);
    const isGroupAdmin = effectiveRole === 'DEALER_GROUP_ADMIN';
    const isDealerLevel = effectiveRole === 'DEALER_ADMIN' || effectiveRole === 'DEALER_EMPLOYEE';
    const canSwitchContext = isPlatformUser;

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            switchContext,
            isLoading,
            effectiveRole,
            isPlatformUser,
            isGroupAdmin,
            isDealerLevel,
            canSwitchContext,
            activeContext,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
