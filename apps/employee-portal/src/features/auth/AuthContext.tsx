import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useBrandConfig } from '../../config/BrandContext';
import {
  EmployeeUser,
  LoginPayload,
  RegisterPayload,
  loginEmployee,
  registerEmployee,
  fetchCurrentEmployee,
  logoutEmployee,
} from './auth-api';

export interface AuthContextValue {
  user: EmployeeUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isServiceUnavailable: boolean;
  sessionError: string | null;
  login: (payload: LoginPayload) => Promise<EmployeeUser>;
  register: (payload: RegisterPayload) => Promise<EmployeeUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config, isLoading: isBrandLoading } = useBrandConfig();
  const [user, setUser] = useState<EmployeeUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isServiceUnavailable, setIsServiceUnavailable] = useState<boolean>(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const requestIdRef = useRef<number>(0);
  const pendingMutationCountRef = useRef<number>(0);
  const mutationQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const runMutation = useCallback(
    async <T,>(mutationFn: () => Promise<T>): Promise<T> => {
      pendingMutationCountRef.current += 1;
      setIsLoading(true);

      const run = async () => {
        try {
          return await mutationFn();
        } finally {
          // Invalidate any in-flight refresh or previous requests on mutation completion
          ++requestIdRef.current;
        }
      };

      // Serialize session mutations
      const nextPromise = mutationQueueRef.current.then(run, run);
      mutationQueueRef.current = nextPromise.catch(() => {});

      try {
        return await nextPromise;
      } finally {
        pendingMutationCountRef.current = Math.max(0, pendingMutationCountRef.current - 1);
        if (pendingMutationCountRef.current === 0) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  const refreshSession = useCallback(async () => {
    // If a session mutation (login/register/logout) is currently pending, suppress refresh
    if (pendingMutationCountRef.current > 0) {
      return;
    }

    const currentReqId = ++requestIdRef.current;
    setIsLoading(true);
    try {
      const employee = await fetchCurrentEmployee(config.apiUrl);
      if (requestIdRef.current === currentReqId && pendingMutationCountRef.current === 0) {
        setUser(employee);
        setIsServiceUnavailable(false);
        setSessionError(null);
      }
    } catch (err: unknown) {
      if (requestIdRef.current === currentReqId && pendingMutationCountRef.current === 0) {
        setUser(null);
        setIsServiceUnavailable(true);
        setSessionError(err instanceof Error ? err.message : 'Wystąpił błąd sesji');
      }
    } finally {
      if (requestIdRef.current === currentReqId && pendingMutationCountRef.current === 0) {
        setIsLoading(false);
      }
    }
  }, [config.apiUrl]);

  useEffect(() => {
    if (!isBrandLoading) {
      refreshSession();
    }
  }, [isBrandLoading, refreshSession]);

  const login = useCallback(
    (payload: LoginPayload): Promise<EmployeeUser> => {
      return runMutation(async () => {
        const employee = await loginEmployee(config.apiUrl, payload);
        setUser(employee);
        setIsServiceUnavailable(false);
        setSessionError(null);
        return employee;
      });
    },
    [config.apiUrl, runMutation]
  );

  const register = useCallback(
    (payload: RegisterPayload): Promise<EmployeeUser> => {
      return runMutation(async () => {
        const employee = await registerEmployee(config.apiUrl, payload);
        setUser(employee);
        setIsServiceUnavailable(false);
        setSessionError(null);
        return employee;
      });
    },
    [config.apiUrl, runMutation]
  );

  const logout = useCallback((): Promise<void> => {
    return runMutation(async () => {
      try {
        await logoutEmployee(config.apiUrl);
        setUser(null);
        setIsServiceUnavailable(false);
        setSessionError(null);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Wystąpił błąd podczas wylogowywania';
        setSessionError(errorMsg);
        throw err;
      }
    });
  }, [config.apiUrl, runMutation]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading: isBrandLoading || isLoading,
        isServiceUnavailable,
        sessionError,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
