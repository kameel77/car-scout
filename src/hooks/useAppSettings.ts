import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/services/api';

export function useAppSettings() {
    return useQuery({
        queryKey: ['appSettings'],
        queryFn: async () => {
            return await settingsApi.getSettings();
        },
        initialData: typeof window !== 'undefined' ? (window as any).__APP_SETTINGS__ ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });
}
