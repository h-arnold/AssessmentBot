import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { queryClient } from './queryClient';

/**
 * Provides the shared React Query client for the frontend session.
 *
 * @param {Readonly<PropsWithChildren>} properties Provider properties.
 * @returns {JSX.Element} The React Query provider wrapper.
 */
export function AppQueryProvider(properties: Readonly<PropsWithChildren>) {
  const { children } = properties;
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
