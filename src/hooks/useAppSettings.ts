import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/services/api';

export function useAppSettings() {
    return useQuery({
        queryKey: ['appSettings'],
        queryFn: async () => {
            return await settingsApi.getSettings();
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
