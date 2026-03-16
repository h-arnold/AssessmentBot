import { QueryClient } from '@tanstack/react-query';

const APP_QUERY_STALE_TIME_MINUTES = 5;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const APP_QUERY_STALE_TIME_MS =
    APP_QUERY_STALE_TIME_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

/**
 * Creates the shared React Query client configuration for the frontend session.
 */
export function createAppQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: APP_QUERY_STALE_TIME_MS,
                gcTime: Infinity,
                retry: false,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
                refetchOnMount: true,
            },
        },
    });
}

export const queryClient = createAppQueryClient();