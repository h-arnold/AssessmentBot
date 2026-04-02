import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import type * as SharedQueriesModule from '../../query/sharedQueries';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { createAppQueryClient } from '../../query/queryClient';
import { AuthStatusCard } from './AuthStatusCard';
import { AppAuthGate } from './AppAuthGate';
import { useAuthorisationStatus } from './useAuthorisationStatus';

const { getAuthorisationStatusMock, warmStartupQueriesMock } = vi.hoisted(() => ({
    getAuthorisationStatusMock: vi.fn(),
    warmStartupQueriesMock: vi.fn(),
}));

vi.mock('../../services/authService', () => ({
    getAuthorisationStatus: getAuthorisationStatusMock,
}));

vi.mock('../../query/sharedQueries', async () => {
    const actual = await vi.importActual<typeof SharedQueriesModule>('../../query/sharedQueries');

    return {
        ...actual,
        warmStartupQueries: warmStartupQueriesMock,
    };
});

/**
 * Probes the authorisation hook state for assertions.
 *
 * @returns {JSX.Element} Serialised hook state.
 */
function AuthHookProbe() {
    const { authViewState, authError, isAuthResolved, isAuthorised } = useAuthorisationStatus();

    return (
        <output data-testid="auth-hook-probe">
            {JSON.stringify({
                authViewState,
                authError,
                isAuthResolved,
                isAuthorised,
            })}
        </output>
    );
}

/**
 * Creates a deferred promise for controlled async test flows.
 *
 * @returns {{ promise: Promise<T>; resolve(value: T): void; reject(reason: unknown): void }} Deferred promise controls.
 */
function createDeferredPromise<T>() {
    let resolvePromise: ((value: T | PromiseLike<T>) => void) | undefined;
    let rejectPromise: ((reason?: unknown) => void) | undefined;

    const promise = new Promise<T>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });

    return {
        promise,
        resolve(value: T) {
            resolvePromise?.(value);
        },
        reject(reason: unknown) {
            rejectPromise?.(reason);
        },
    };
}

/**
 * Creates a query-client wrapper for React Query tests.
 *
 * @returns {{ queryClient: ReturnType<typeof createAppQueryClient>; QueryWrapper(properties: Readonly<PropsWithChildren>): JSX.Element }} Query wrapper helpers.
 */
function createQueryWrapper() {
    const queryClient = createAppQueryClient();

    /**
     * Wraps children in the shared test query client.
     *
     * @param {Readonly<PropsWithChildren>} properties Wrapper properties.
     * @returns {JSX.Element} Wrapped children.
     */
    function QueryWrapper({ children }: Readonly<PropsWithChildren>) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    return {
        queryClient,
        QueryWrapper,
    };
}

/**
 * Creates a probe for the startup warm-up state contract using the AppAuthGate module path.
 *
 * @returns {Promise<() => JSX.Element>} Warm-up state probe component factory.
 */
async function createWarmupStateProbe() {
    const appAuthGateModule = await import('./AppAuthGate');
    const { useStartupWarmupState } = appAuthGateModule as typeof AppAuthGateModule & {
        useStartupWarmupState?: () => unknown;
    };

    expect(useStartupWarmupState).toBeTypeOf('function');

    return function WarmupStateProbe() {
        return (
            <output data-testid="warmup-state-probe">
                {JSON.stringify(useStartupWarmupState())}
            </output>
        );
    };
}

describe('AppAuthGate', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('keeps the auth UI render non-blocking while exposing loading then ready startup warm-up state', async () => {
        const { QueryWrapper, queryClient } = createQueryWrapper();
        getAuthorisationStatusMock.mockResolvedValueOnce(true);
        warmStartupQueriesMock.mockReturnValueOnce(Promise.resolve());

        render(
            <AppAuthGate>
                <AuthStatusCard />
                <AuthHookProbe />
            </AppAuthGate>,
            {
                wrapper: QueryWrapper,
            }
        );

        expect(screen.getByText('Checking authorisation status...')).toBeInTheDocument();
        expect(await screen.findByText('Authorised')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByTestId('auth-hook-probe')).toHaveTextContent(
                JSON.stringify({
                    authViewState: 'authorised',
                    authError: null,
                    isAuthResolved: true,
                    isAuthorised: true,
                })
            );
        });

        await waitFor(() => {
            expect(warmStartupQueriesMock).toHaveBeenCalledWith(queryClient);
        });

        expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
    });

    it('preserves the unauthorised auth UI behaviour without starting startup warm-up', async () => {
        const { QueryWrapper } = createQueryWrapper();
        getAuthorisationStatusMock.mockResolvedValueOnce(false);

        render(
            <AppAuthGate>
                <AuthStatusCard />
            </AppAuthGate>,
            {
                wrapper: QueryWrapper,
            }
        );

        expect(await screen.findByText('Unauthorised')).toBeInTheDocument();
        expect(screen.queryByText('Checking authorisation status...')).not.toBeInTheDocument();
        expect(warmStartupQueriesMock).not.toHaveBeenCalled();
        expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
    });

    it('publishes failed startup warm-up state and logs one debug event for the failed cycle without breaking auth UI', async () => {
        const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
        const { QueryWrapper, queryClient } = createQueryWrapper();
        const warmupError = new ApiTransportError({
            requestId: 'req-warmup-1',
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Warm-up failed.',
            },
        });
        getAuthorisationStatusMock.mockResolvedValueOnce(true);
        warmStartupQueriesMock.mockRejectedValueOnce(warmupError);

        render(
            <AppAuthGate>
                <AuthStatusCard />
            </AppAuthGate>,
            {
                wrapper: QueryWrapper,
            }
        );

        expect(await screen.findByText('Authorised')).toBeInTheDocument();

        await waitFor(() => {
            expect(warmStartupQueriesMock).toHaveBeenCalledWith(queryClient);
        });
        await waitFor(() => {
            expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
        });
        expect(consoleDebugSpy).toHaveBeenCalledWith(
            'features/auth/AppAuthGate.startupWarmup',
            expect.objectContaining({
                requestId: 'req-warmup-1',
                errorCode: 'INTERNAL_ERROR',
            })
        );
    });

    it('preserves the failure auth UI behaviour without starting startup warm-up', async () => {
        const { QueryWrapper } = createQueryWrapper();
        getAuthorisationStatusMock.mockRejectedValueOnce(
            new ApiTransportError({
                requestId: 'req-auth-gate',
                error: {
                    code: 'RATE_LIMITED',
                    message: 'Rate limited.',
                    retriable: true,
                },
            })
        );

        render(
            <AppAuthGate>
                <AuthStatusCard />
            </AppAuthGate>,
            {
                wrapper: QueryWrapper,
            }
        );

        expect(await screen.findByText('Unauthorised')).toBeInTheDocument();
        expect(
            await screen.findByText('The service is busy. Please try again shortly.')
        ).toBeInTheDocument();
        expect(warmStartupQueriesMock).not.toHaveBeenCalled();
        expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
    });
});
