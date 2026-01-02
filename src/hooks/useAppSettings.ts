import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/services/api';

export function useAppSettings() {
    return useQuery({
        queryKey: ['appSettings'],
        queryFn: async () => {
            return await settingsApi.getSettings();
        },
        staleTime: 0,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
    });
}
