import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

interface User {
    id: string;
    email: string;
    name: string | null;
    role: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    isLoading: boolean;
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
                    setUser(user);
                } catch (error) {
                    localStorage.removeItem('auth_token');
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
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
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
