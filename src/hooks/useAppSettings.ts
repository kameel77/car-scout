import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/services/api';
import { readSsrJson } from '@/lib/ssrData';

export function useAppSettings() {
    return useQuery({
        queryKey: ['appSettings'],
        queryFn: async () => {
            return await settingsApi.getSettings();
        },
        initialData: readSsrJson<any>('app-settings') ?? undefined,
        initialDataUpdatedAt: 0,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });
}
