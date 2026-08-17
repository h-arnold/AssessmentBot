import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import type * as AssignmentDefinitionPartialsServiceModule from '../../services/assignmentDefinition/assignmentDefinitionPartialsService';
import type * as SharedQueriesModule from '../../query/sharedQueries';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import {
  getStartupWarmupQueryKey,
  startupWarmupDatasetKeys,
  startupWarmupQueryKeys,
} from '../../query/sharedQueries';
import { createAppQueryClient } from '../../query/queryClient';
import { AuthStatusCard } from './AuthStatusCard';
import { AppAuthGate } from './AppAuthGate';
import { useStartupWarmupState, type StartupWarmupSnapshot } from './startupWarmupState';

const {
  getAuthorisationStatusMock,
  warmStartupQueriesMock,
  getABClassPartialsMock,
  getAssignmentDefinitionPartialsMock,
  callApiMock,
  getCohortsMock,
  getAssignmentTopicsMock,
  getYearGroupsMock,
} = vi.hoisted(() => ({
  getAuthorisationStatusMock: vi.fn(),
  warmStartupQueriesMock: vi.fn(),
  getABClassPartialsMock: vi.fn(),
  getAssignmentDefinitionPartialsMock: vi.fn(),
  callApiMock: vi.fn(),
  getCohortsMock: vi.fn(),
  getAssignmentTopicsMock: vi.fn(),
  getYearGroupsMock: vi.fn(),
}));

vi.mock('../../services/authService/authService', () => ({
  getAuthorisationStatus: getAuthorisationStatusMock,
}));

vi.mock('../../services/googleClassrooms/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../../services/assignmentDefinition/assignmentDefinitionPartialsService', () => ({
  getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
}));

vi.mock('../../services/apiService', () => ({
  callApi: callApiMock,
}));

vi.mock('../../services/referenceData/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  getYearGroups: getYearGroupsMock,
}));

vi.mock('../../services/assignmentDefinition/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
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
  snapshot?: StartupWarmupSnapshot;
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
  const warmupState = useStartupWarmupState();

  return (
    <output data-testid="startup-warmup-probe">
      {JSON.stringify({
        warmupState: warmupState.warmupState,
        isLoading: warmupState.isLoading,
        isReady: warmupState.isReady,
        isFailed: warmupState.isFailed,
      })}
    </output>
  );
}

/**
 * Probes dataset-level startup warm-up semantics for assertions.
 *
 * @returns {JSX.Element} Serialised dataset-level warm-up state.
 */
function StartupWarmupDatasetProbe() {
  const warmupState = useStartupWarmupState();

  return (
    <output data-testid="startup-warmup-dataset-probe">
      {JSON.stringify({
        warmupState: warmupState.warmupState,
        snapshot: warmupState.snapshot,
        classPartialsReady: warmupState.isDatasetReady('classPartials'),
        assignmentDefinitionPartialsFailed: warmupState.isDatasetFailed(
          'assignmentDefinitionPartials'
        ),
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

/**
 * Configures startup warm-up mocks so assignment definitions fail while class datasets succeed.
 *
 * @returns {Promise<void>} Resolves once the shared warm-up implementation is wired.
 */
async function configureAssignmentDefinitionWarmupFailure(): Promise<void> {
  const { warmStartupQueries: actualWarmStartupQueries } = await vi.importActual<
    typeof SharedQueriesModule
  >('../../query/sharedQueries');
  getAuthorisationStatusMock.mockResolvedValueOnce(true);
  warmStartupQueriesMock.mockImplementationOnce((queryClient) =>
    actualWarmStartupQueries(queryClient)
  );
  getABClassPartialsMock.mockResolvedValueOnce([{ classId: 'class-1', className: 'Class 1' }]);
  getCohortsMock.mockResolvedValueOnce([{ key: 'cohort-2026', name: 'Cohort 2026', active: true }]);
  getYearGroupsMock.mockResolvedValueOnce([{ key: 'year-10', name: 'Year 10' }]);
  getAssignmentTopicsMock.mockResolvedValueOnce([{ key: 'topic-algebra', name: 'Algebra' }]);
  getAssignmentDefinitionPartialsMock.mockRejectedValueOnce(
    new Error('Assignment definitions warm-up failed.')
  );
}

const backendCompatibleAssignmentDefinitionPartial = {
  primaryTitle: 'Algebra Baseline',
  primaryTopicKey: 'topic-algebra',
  primaryTopic: 'Algebra',
  yearGroupKey: 'year-group-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: ['Algebra Starter'],
  alternateTopics: ['Linear Equations'],
  documentType: 'SLIDES',
  referenceDocumentId: 'ref-doc-001',
  templateDocumentId: 'tpl-doc-001',
  assignmentWeighting: null,
  definitionKey: 'algebra-baseline',
  tasks: [],
  createdAt: '2026-01-05T10:00:00.000Z',
  updatedAt: null,
};

describe('AppAuthGate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('blocks protected children until authorisation has resolved, then tracks warm-up state', async () => {
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
    expect(screen.queryByTestId('startup-warmup-probe')).not.toBeInTheDocument();

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

  it('renders the permissions-required gate surface without starting startup warm-up', async () => {
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

    expect(await screen.findByText('Permissions required')).toBeInTheDocument();
    expect(screen.queryByText('Unauthorised')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Loading authorisation status' })
    ).not.toBeInTheDocument();
    expect(warmStartupQueriesMock).not.toHaveBeenCalled();
    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });

  it('renders the access-denied surface when a warm-up query reports FORBIDDEN', async () => {
    const { QueryWrapper, queryClient } = createQueryWrapper();
    const forbiddenError = new ApiTransportError({
      requestId: 'req-warmup-forbidden',
      error: { code: 'FORBIDDEN', message: 'Access denied.', retriable: false },
    });
    queryClient.setQueryData(getStartupWarmupQueryKey('classPartials'), []);
    queryClient.getQueryCache().find({
      queryKey: getStartupWarmupQueryKey('classPartials'),
    })?.setState({
      data: undefined,
      dataUpdateCount: 0,
      dataUpdatedAt: 0,
      error: forbiddenError,
      errorUpdateCount: 1,
      errorUpdatedAt: Date.now(),
      fetchFailureCount: 1,
      fetchFailureReason: forbiddenError,
      fetchMeta: undefined,
      isInvalidated: false,
      status: 'error',
      fetchStatus: 'idle',
    });
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockResolvedValueOnce({});

    render(
      <AppAuthGate>
        <output>Protected content</output>
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    expect(
      await screen.findByText(
        'You do not have permission to access this application. Please contact your administrator.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders the loading gate surface while authorisation is pending', () => {
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockReturnValueOnce(new Promise<boolean>(() => {}));

    render(
      <AppAuthGate>
        <output>Protected content</output>
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    expect(screen.getByRole('status', { name: 'Loading authorisation status' })).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders the transport error and retry surface without protected children', async () => {
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockRejectedValueOnce(
      new ApiTransportError({
        requestId: 'req-auth-gate-surface',
        error: { code: 'RATE_LIMITED', message: 'Rate limited.', retriable: true },
      })
    );

    render(
      <AppAuthGate>
        <output>Protected content</output>
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    expect(
      await screen.findByText('Too many requests. Please wait a moment and try again.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('publishes failed startup warm-up state and logs one error event for the failed cycle without breaking auth UI', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'features/auth/AppAuthGate.startupWarmup',
      expect.objectContaining({
        context: 'features/auth/AppAuthGate.startupWarmup',
        metadata: expect.objectContaining({
          requestId: 'req-warmup-1',
          errorCode: 'INTERNAL_ERROR',
          datasets: [...startupWarmupDatasetKeys],
          queryKeys: [...startupWarmupQueryKeys],
        }),
      })
    );
  });

  it('publishes mixed dataset warm-up outcomes through AppAuthGate when assignment definitions fail', async () => {
    await configureAssignmentDefinitionWarmupFailure();
    const { QueryWrapper } = createQueryWrapper();

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
      expect(getAssignmentTopicsMock).toHaveBeenCalledTimes(1);
      expect(getAssignmentDefinitionPartialsMock).toHaveBeenCalledTimes(1);
    });

    expect(readStartupWarmupDatasetProbeSnapshot()).toMatchObject({
      warmupState: 'failed',
      snapshot: {
        datasets: {
          classPartials: { status: 'ready', isTrustworthy: true },
          assignmentDefinitionPartials: { status: 'failed', isTrustworthy: false },
          assignmentTopics: { status: 'ready', isTrustworthy: true },
          cohorts: { status: 'ready', isTrustworthy: true },
          yearGroups: { status: 'ready', isTrustworthy: true },
        },
      },
    });
  });

  it('keeps class datasets ready in helper semantics when assignment definitions fail in warm-up', async () => {
    await configureAssignmentDefinitionWarmupFailure();
    const { QueryWrapper } = createQueryWrapper();

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

  it('keeps startup warm-up ready when assignment definitions arrive with backend-compatible non-null tasks', async () => {
    const actualAssignmentDefinitionPartialsService = await vi.importActual<
      typeof AssignmentDefinitionPartialsServiceModule
    >('../../services/assignmentDefinition/assignmentDefinitionPartialsService');
    const { warmStartupQueries: actualWarmStartupQueries } = await vi.importActual<
      typeof SharedQueriesModule
    >('../../query/sharedQueries');
    const { QueryWrapper, queryClient } = createQueryWrapper();

    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockImplementationOnce((currentQueryClient) =>
      actualWarmStartupQueries(currentQueryClient)
    );
    getABClassPartialsMock.mockResolvedValueOnce([{ classId: 'class-1', className: 'Class 1' }]);
    getCohortsMock.mockResolvedValueOnce([
      { key: 'cohort-2026', name: 'Cohort 2026', active: true },
    ]);
    getYearGroupsMock.mockResolvedValueOnce([{ key: 'year-10', name: 'Year 10' }]);
    getAssignmentTopicsMock.mockResolvedValueOnce([{ key: 'topic-algebra', name: 'Algebra' }]);
    getAssignmentDefinitionPartialsMock.mockImplementationOnce(
      actualAssignmentDefinitionPartialsService.getAssignmentDefinitionPartials
    );
    callApiMock.mockResolvedValueOnce([backendCompatibleAssignmentDefinitionPartial]);

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
      expect(getAssignmentDefinitionPartialsMock).toHaveBeenCalledTimes(1);
    });

    expect(readStartupWarmupDatasetProbeSnapshot()).toMatchObject({
      warmupState: 'ready',
      snapshot: {
        datasets: {
          assignmentDefinitionPartials: { status: 'ready', isTrustworthy: true },
        },
      },
    });
    expect(
      queryClient.getQueryData(getStartupWarmupQueryKey('assignmentDefinitionPartials'))
    ).toEqual([
      {
        ...backendCompatibleAssignmentDefinitionPartial,
        tasks: [],
      },
    ]);
    expect(callApiMock).toHaveBeenCalledWith('getAssignmentDefinitionPartials');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('reuses an in-flight warm-up cycle across remounts and moves to failed when that shared cycle rejects', async () => {
    const deferredWarmup = createDeferredPromise<void>();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
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

    expect(
      await screen.findByText('Too many requests. Please wait a moment and try again.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Unauthorised')).not.toBeInTheDocument();
    expect(warmStartupQueriesMock).not.toHaveBeenCalled();
    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });
});
