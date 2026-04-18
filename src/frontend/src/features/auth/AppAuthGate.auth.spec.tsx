import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import type * as SharedQueriesModule from '../../query/sharedQueries';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { createAppQueryClient } from '../../query/queryClient';
import { AuthStatusCard } from './AuthStatusCard';
import { AppAuthGate } from './AppAuthGate';
import { useStartupWarmupState } from './startupWarmupState';

const {
  getAuthorisationStatusMock,
  warmStartupQueriesMock,
  getABClassPartialsMock,
  getAssignmentDefinitionPartialsMock,
  getCohortsMock,
  getYearGroupsMock,
} = vi.hoisted(() => ({
  getAuthorisationStatusMock: vi.fn(),
  warmStartupQueriesMock: vi.fn(),
  getABClassPartialsMock: vi.fn(),
  getAssignmentDefinitionPartialsMock: vi.fn(),
  getCohortsMock: vi.fn(),
  getYearGroupsMock: vi.fn(),
}));

vi.mock('../../services/authService', () => ({
  getAuthorisationStatus: getAuthorisationStatusMock,
}));

vi.mock('../../services/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../../services/assignmentDefinitionPartialsService', () => ({
  getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
}));

vi.mock('../../services/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  getYearGroups: getYearGroupsMock,
}));

vi.mock('../../query/sharedQueries', async () => {
  const actual = await vi.importActual<typeof SharedQueriesModule>('../../query/sharedQueries');

  return {
    ...actual,
    warmStartupQueries: warmStartupQueriesMock,
  };
});

type StartupWarmupDatasetProbeSnapshot = Readonly<{
  warmupState?: string;
  snapshot?: {
    datasets?: {
      classPartials?: {
        status?: string;
        isTrustworthy?: boolean;
      };
      cohorts?: {
        status?: string;
        isTrustworthy?: boolean;
      };
      yearGroups?: {
        status?: string;
        isTrustworthy?: boolean;
      };
      assignmentDefinitionPartials?: {
        status?: string;
        isTrustworthy?: boolean;
      };
    };
  };
  classPartialsReady?: boolean | null;
  assignmentDefinitionPartialsFailed?: boolean | null;
}>;

/**
 * Creates a deferred promise for async test control.
 *
 * @template T
 * @returns {{ promise: Promise<T>; resolvePromise: (value: T) => void; rejectPromise: (error: unknown) => void }} Deferred promise helpers.
 */
function createDeferredPromise<T>() {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolvePromise,
    rejectPromise,
  };
}

/**
 * Probes the startup warm-up hook state for assertions.
 *
 * @returns {JSX.Element} Serialised hook state.
 */
function StartupWarmupProbe() {
  return <output data-testid="startup-warmup-probe">{JSON.stringify(useStartupWarmupState())}</output>;
}

/**
 * Probes dataset-level startup warm-up semantics for assertions.
 *
 * @returns {JSX.Element} Serialised dataset-level warm-up state.
 */
function StartupWarmupDatasetProbe() {
  const warmupState = useStartupWarmupState() as unknown as {
    warmupState: string;
    snapshot?: StartupWarmupDatasetProbeSnapshot['snapshot'];
    isDatasetReady?: (datasetKey: string) => boolean;
    isDatasetFailed?: (datasetKey: string) => boolean;
  };

  return (
    <output data-testid="startup-warmup-dataset-probe">
      {JSON.stringify({
        warmupState: warmupState.warmupState,
        snapshot: warmupState.snapshot,
        classPartialsReady: warmupState.isDatasetReady?.('classPartials') ?? null,
        assignmentDefinitionPartialsFailed:
          warmupState.isDatasetFailed?.('assignmentDefinitionPartials') ?? null,
      })}
    </output>
  );
}

/**
 * Reads the dataset-level warm-up probe snapshot.
 *
 * @returns {StartupWarmupDatasetProbeSnapshot} Parsed dataset-level probe state.
 */
function readStartupWarmupDatasetProbeSnapshot(): StartupWarmupDatasetProbeSnapshot {
  return JSON.parse(screen.getByTestId('startup-warmup-dataset-probe').textContent ?? '{}');
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

describe('AppAuthGate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('keeps the auth UI render non-blocking while warm-up state moves from loading to ready', async () => {
    const deferredWarmup = createDeferredPromise<void>();
    const { QueryWrapper, queryClient } = createQueryWrapper();
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockReturnValueOnce(deferredWarmup.promise);

    render(
      <AppAuthGate>
        <AuthStatusCard />
        <StartupWarmupProbe />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    expect(screen.getByRole('status', { name: 'Loading authorisation status' })).toBeInTheDocument();
    expect(screen.getByTestId('startup-warmup-probe')).toHaveTextContent(
      JSON.stringify({
        warmupState: 'loading',
        isLoading: true,
        isReady: false,
        isFailed: false,
      })
    );

    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(screen.getByTestId('startup-warmup-probe')).toHaveTextContent(
      JSON.stringify({
        warmupState: 'loading',
        isLoading: true,
        isReady: false,
        isFailed: false,
      })
    );

    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledWith(queryClient);
    });

    deferredWarmup.resolvePromise();

    await waitFor(() => {
      expect(screen.getByTestId('startup-warmup-probe')).toHaveTextContent(
        JSON.stringify({
          warmupState: 'ready',
          isLoading: false,
          isReady: true,
          isFailed: false,
        })
      );
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
    expect(screen.queryByRole('status', { name: 'Loading authorisation status' })).not.toBeInTheDocument();
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
        <StartupWarmupProbe />
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
      expect(screen.getByTestId('startup-warmup-probe')).toHaveTextContent(
        JSON.stringify({
          warmupState: 'failed',
          isLoading: false,
          isReady: false,
          isFailed: true,
        })
      );
    });
    expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      'features/auth/AppAuthGate.startupWarmup',
      expect.objectContaining({
        requestId: 'req-warmup-1',
        errorCode: 'INTERNAL_ERROR',
        metadata: expect.objectContaining({
          datasets: ['classPartials', 'cohorts', 'yearGroups', 'assignmentDefinitionPartials'],
        }),
      })
    );
  });

  it('publishes mixed dataset warm-up outcomes through AppAuthGate when assignment definitions fail', async () => {
    const { warmStartupQueries: actualWarmStartupQueries } =
      await vi.importActual<typeof SharedQueriesModule>('../../query/sharedQueries');
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockImplementationOnce((queryClient) => actualWarmStartupQueries(queryClient));
    getABClassPartialsMock.mockResolvedValueOnce([{ classId: 'class-1', className: 'Class 1' }]);
    getCohortsMock.mockResolvedValueOnce([{ key: 'cohort-2026', name: 'Cohort 2026', active: true }]);
    getYearGroupsMock.mockResolvedValueOnce([{ key: 'year-10', name: 'Year 10' }]);
    getAssignmentDefinitionPartialsMock.mockRejectedValueOnce(
      new Error('Assignment definitions warm-up failed.')
    );

    render(
      <AppAuthGate>
        <AuthStatusCard />
        <StartupWarmupDatasetProbe />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    expect(await screen.findByText('Authorised')).toBeInTheDocument();

    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(getABClassPartialsMock).toHaveBeenCalledTimes(1);
      expect(getCohortsMock).toHaveBeenCalledTimes(1);
      expect(getYearGroupsMock).toHaveBeenCalledTimes(1);
      expect(getAssignmentDefinitionPartialsMock).toHaveBeenCalledTimes(1);
    });

    expect(readStartupWarmupDatasetProbeSnapshot()).toMatchObject({
      warmupState: 'failed',
      snapshot: {
        datasets: {
          classPartials: { status: 'ready', isTrustworthy: true },
          cohorts: { status: 'ready', isTrustworthy: true },
          yearGroups: { status: 'ready', isTrustworthy: true },
          assignmentDefinitionPartials: { status: 'failed', isTrustworthy: false },
        },
      },
    });
  });

  it('keeps class datasets ready in helper semantics when assignment definitions fail in warm-up', async () => {
    const { warmStartupQueries: actualWarmStartupQueries } =
      await vi.importActual<typeof SharedQueriesModule>('../../query/sharedQueries');
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockImplementationOnce((queryClient) => actualWarmStartupQueries(queryClient));
    getABClassPartialsMock.mockResolvedValueOnce([{ classId: 'class-1', className: 'Class 1' }]);
    getCohortsMock.mockResolvedValueOnce([{ key: 'cohort-2026', name: 'Cohort 2026', active: true }]);
    getYearGroupsMock.mockResolvedValueOnce([{ key: 'year-10', name: 'Year 10' }]);
    getAssignmentDefinitionPartialsMock.mockRejectedValueOnce(
      new Error('Assignment definitions warm-up failed.')
    );

    render(
      <AppAuthGate>
        <StartupWarmupDatasetProbe />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledTimes(1);
      expect(getAssignmentDefinitionPartialsMock).toHaveBeenCalledTimes(1);
    });

    expect(readStartupWarmupDatasetProbeSnapshot()).toMatchObject({
      classPartialsReady: true,
      assignmentDefinitionPartialsFailed: true,
    });
  });

  it('reuses an in-flight warm-up cycle across remounts and moves to failed when that shared cycle rejects', async () => {
    const deferredWarmup = createDeferredPromise<void>();
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { QueryWrapper, queryClient } = createQueryWrapper();
    getAuthorisationStatusMock.mockResolvedValue(true);
    warmStartupQueriesMock.mockReturnValue(deferredWarmup.promise);

    const { unmount } = render(
      <AppAuthGate>
        <StartupWarmupProbe />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledWith(queryClient);
    });

    unmount();

    render(
      <AppAuthGate>
        <StartupWarmupProbe />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    deferredWarmup.rejectPromise(new Error('Warm-up remount failure.'));

    await waitFor(() => {
      expect(screen.getByTestId('startup-warmup-probe')).toHaveTextContent(
        JSON.stringify({
          warmupState: 'failed',
          isLoading: false,
          isReady: false,
          isFailed: true,
        })
      );
    });

    expect(warmStartupQueriesMock).toHaveBeenCalledTimes(1);
    expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
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
