import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import {
  StartupWarmupStateProvider,
  useStartupWarmupState,
  type StartupWarmupSnapshot,
} from './startupWarmupState';

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

    // OAuth still pending: the OAuth authorisation status surface is shown and the
    // protected children are not yet rendered.
    expect(screen.getByRole('status', { name: 'Loading authorisation status' })).toBeInTheDocument();
    expect(screen.queryByText('Authorised')).not.toBeInTheDocument();
    expect(screen.queryByTestId('startup-warmup-probe')).not.toBeInTheDocument();

    // OAuth has resolved but warm-up is still loading: fail-closed "Verifying access"
    // surface is shown and the protected children remain hidden.
    const verifyingSurface = await screen.findByRole('status', { name: 'Verifying access' });
    expect(verifyingSurface).toBeInTheDocument();
    expect(verifyingSurface).toHaveTextContent('Verifying access');
    expect(screen.queryByText('Authorised')).not.toBeInTheDocument();
    expect(screen.queryByTestId('startup-warmup-probe')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledWith(queryClient);
    });

    deferredWarmup.resolvePromise();

    // Warm-up reaches ready: children render inside the warm-up provider and the
    // warm-up state publishes `ready`.
    await waitFor(() => {
      expect(screen.getByText('Authorised')).toBeInTheDocument();
    });
    expect(screen.getByTestId('startup-warmup-probe')).toHaveTextContent(
      JSON.stringify({
        warmupState: 'ready',
        isLoading: false,
        isReady: true,
        isFailed: false,
      })
    );

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

  it('renders a status region with a visible spinner while authorisation is pending', () => {
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockReturnValueOnce(new Promise<boolean>(() => {}));

    render(
      <AppAuthGate>
        <output>Protected content</output>
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    const statusRegion = screen.getByRole('status', { name: 'Loading authorisation status' });
    expect(statusRegion).toBeInTheDocument();
    // The loading region must pair accessible status semantics with a visible spinner
    // (an Ant Design Spin that carries role="status", or a status element containing one).
    expect(
      statusRegion.classList.contains('ant-spin') ||
        statusRegion.querySelector('.ant-spin') !== null
    ).toBe(true);
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

    // Fail-closed: a non-FORBIDDEN warm-up failure blocks the dashboard with the
    // error Result whose title is the mapped code message; children are not revealed.
    expect(
      await screen.findByText(
        'An internal error occurred. Please try again or contact support if the issue persists.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Authorised')).not.toBeInTheDocument();
    expect(screen.queryByTestId('startup-warmup-probe')).not.toBeInTheDocument();
    // Fail-closed recovery affordance: the blocked surface exposes a primary "Reload"
    // button (a full page reload re-runs warm-up from a fresh QueryClient).
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();

    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledWith(queryClient);
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

  it('reloads the page when the Reload button is clicked in the failed warm-up surface', async () => {
    // Stub the reload so the test environment is not navigated. The production branch calls
    // `globalThis.location.reload()`; happy-dom exposes `location.reload` as a spyable method.
    const reloadSpy = vi.spyOn(globalThis.location, 'reload').mockImplementation(() => {});
    const user = userEvent.setup();
    const { QueryWrapper } = createQueryWrapper();
    const warmupError = new ApiTransportError({
      requestId: 'req-warmup-reload',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Warm-up failed.',
      },
    });
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockRejectedValueOnce(warmupError);

    render(
      <AppAuthGate>
        <output>Protected content</output>
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    const reloadButton = await screen.findByRole('button', { name: 'Reload' });
    expect(reloadButton).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();

    await user.click(reloadButton);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('publishes mixed dataset warm-up outcomes through AppAuthGate when assignment definitions fail', async () => {
    await configureAssignmentDefinitionWarmupFailure();
    const { QueryWrapper } = createQueryWrapper();

    render(
      <AppAuthGate>
        <AuthStatusCard />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    // A partial warm-up failure (assignment definitions reject, class datasets would
    // succeed) still fails the cycle. Fail-closed rendering blocks the dashboard with
    // the generic error Result because the rejection carries no error code.
    expect(await screen.findByText('An error occurred. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Authorised')).not.toBeInTheDocument();
    // The blocked surface exposes the primary "Reload" recovery affordance.
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();

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
  });

  it('keeps class datasets ready in helper semantics when assignment definitions fail in warm-up', () => {
    // Under fail-closed rendering the warm-up snapshot is only published to children via
    // the StartupWarmupStateProvider, which is not rendered while the cycle is unresolved.
    // The mixed dataset semantics (class datasets ready while assignment definitions fail)
    // remain covered here by mounting the provider directly with a representative snapshot,
    // complementing the uniform-state coverage in startupWarmupState.spec.tsx.
    const mixedSnapshot: StartupWarmupSnapshot = {
      datasets: {
        classPartials: { status: 'ready', isTrustworthy: true },
        assignmentDefinitionPartials: { status: 'failed', isTrustworthy: false },
        assignmentTopics: { status: 'ready', isTrustworthy: true },
        cohorts: { status: 'ready', isTrustworthy: true },
        yearGroups: { status: 'ready', isTrustworthy: true },
      },
    };

    render(
      <StartupWarmupStateProvider warmupState="failed" snapshot={mixedSnapshot}>
        <StartupWarmupDatasetProbe />
      </StartupWarmupStateProvider>
    );

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

    // Fail-closed: the shared rejected cycle blocks the dashboard with the generic error
    // Result (the rejection carries no error code); children are not revealed.
    expect(await screen.findByText('An error occurred. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Authorised')).not.toBeInTheDocument();
    // The blocked surface exposes the primary "Reload" recovery affordance.
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();

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
