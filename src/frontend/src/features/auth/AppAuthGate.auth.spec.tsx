import { render, screen, waitFor } from '@testing-library/react';
import type * as AssignmentDefinitionPartialsServiceModule from '../../services/assignmentDefinition/assignmentDefinitionPartialsService';
import type * as SharedQueriesModule from '../../query/sharedQueries';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import {
  getStartupWarmupQueryKey,
  startupWarmupDatasetKeys,
  startupWarmupQueryKeys,
} from '../../query/sharedQueries';
import { createQueryWrapper, grantedAdminAccess } from '../../test/auth/appAuthGateTestHelpers';
import { createDeferredPromise } from '../../test/shared/testDeferredPromise';
import { AuthStatusCard } from './AuthStatusCard';
import { AppAuthGate } from './AppAuthGate';
import {
  StartupWarmupStateProvider,
  useStartupWarmupState,
  type StartupWarmupSnapshot,
} from './startupWarmupState';

const {
  getAuthorisationStatusMock,
  getApplicationAccessMock,
  warmStartupQueriesMock,
  getABClassPartialsMock,
  getAssignmentDefinitionPartialsMock,
  callApiMock,
  getCohortsMock,
  getAssignmentTopicsMock,
  getYearGroupsMock,
} = vi.hoisted(() => ({
  getAuthorisationStatusMock: vi.fn(),
  getApplicationAccessMock: vi.fn(),
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
  getApplicationAccess: getApplicationAccessMock,
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

const GRANTED_ACCESS = grantedAdminAccess;

type StartupWarmupDatasetProbeSnapshot = Readonly<{
  warmupState?: string;
  snapshot?: StartupWarmupSnapshot;
  classPartialsReady?: boolean | null;
  assignmentDefinitionPartialsFailed?: boolean | null;
}>;

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

  it('blocks protected children until authorisation resolves, then verifies access and tracks warm-up state', async () => {
    const deferredAuth = createDeferredPromise<boolean>();
    const deferredAccess = createDeferredPromise<typeof GRANTED_ACCESS>();
    const deferredWarmup = createDeferredPromise<void>();
    const { QueryWrapper, queryClient } = createQueryWrapper();
    getAuthorisationStatusMock.mockReturnValueOnce(deferredAuth.promise);
    getApplicationAccessMock.mockReturnValueOnce(deferredAccess.promise);
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

    // OAuth has resolved but application access is still loading: fail-closed "Verifying access"
    // surface is shown and the protected children remain hidden.
    deferredAuth.resolvePromise(true);
    const verifyingSurface = await screen.findByRole('status', { name: 'Verifying access' });
    expect(verifyingSurface).toBeInTheDocument();
    expect(verifyingSurface).toHaveTextContent('Verifying access');
    expect(screen.queryByText('Authorised')).not.toBeInTheDocument();
    expect(screen.queryByTestId('startup-warmup-probe')).not.toBeInTheDocument();

    // Access resolves granted: admission completes, the warm-up prefetch starts, and the
    // protected children render inside the warm-up provider with a loading warm-up state.
    deferredAccess.resolvePromise(GRANTED_ACCESS);

    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledWith(queryClient);
    });

    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(screen.getByTestId('startup-warmup-probe')).toHaveTextContent(
      JSON.stringify({
        warmupState: 'loading',
        isLoading: true,
        isReady: false,
        isFailed: false,
      })
    );

    // Warm-up reaches ready: the warm-up state publishes `ready`.
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
    expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
  });

  it('renders the permissions-required gate surface without starting application access or warm-up', async () => {
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
    expect(getApplicationAccessMock).not.toHaveBeenCalled();
    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });

  it('does not block the shell on a FORBIDDEN warm-up failure because admission is access-based', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { QueryWrapper } = createQueryWrapper();
    const forbiddenError = new ApiTransportError({
      requestId: 'req-warmup-forbidden',
      error: { code: 'FORBIDDEN', message: 'Access denied.', retriable: false },
    });
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    getApplicationAccessMock.mockResolvedValueOnce({ ...GRANTED_ACCESS });
    warmStartupQueriesMock.mockRejectedValueOnce(forbiddenError);

    render(
      <AppAuthGate>
        <output>Protected content</output>
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'You do not have permission to access this application. Please contact your administrator.'
      )
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledTimes(1);
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
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

  it('marks the authorisation and access loading status regions busy for assistive technology', async () => {
    const deferredAuth = createDeferredPromise<boolean>();
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockReturnValueOnce(deferredAuth.promise);
    getApplicationAccessMock.mockImplementationOnce(() => new Promise(() => {}));
    // This test only observes the loading surfaces and does not assert warm-up gating.
    // The never-resolving double is a defensive stub so an unexpected warm-up start
    // cannot disturb those assertions; warm-up gating is covered by
    // AppAuthGate.applicationAccess.spec.tsx.
    warmStartupQueriesMock.mockReturnValueOnce(new Promise(() => {}));

    render(
      <AppAuthGate>
        <output>Protected content</output>
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    const authorisationStatus = screen.getByRole('status', {
      name: 'Loading authorisation status',
    });
    expect(authorisationStatus).toHaveAttribute('aria-busy', 'true');

    deferredAuth.resolvePromise(true);

    const accessStatus = await screen.findByRole('status', { name: 'Verifying access' });
    expect(accessStatus).toHaveAttribute('aria-busy', 'true');
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

  it('publishes failed startup warm-up state and logs one error event without blocking the shell', async () => {
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
    getApplicationAccessMock.mockResolvedValueOnce({ ...GRANTED_ACCESS });
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

    // A warm-up failure no longer fails the shell closed: children render and the
    // failed warm-up state is published through the warm-up provider.
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
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

    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledWith(queryClient);
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'features/auth/useStartupWarmupCycle',
      expect.objectContaining({
        context: 'features/auth/useStartupWarmupCycle',
        metadata: expect.objectContaining({
          requestId: 'req-warmup-1',
          errorCode: 'INTERNAL_ERROR',
          datasets: [...startupWarmupDatasetKeys],
          queryKeys: [...startupWarmupQueryKeys],
        }),
      })
    );

    consoleErrorSpy.mockRestore();
  });

  it('publishes failed warm-up state to children without a blocking Reload surface', async () => {
    const { QueryWrapper } = createQueryWrapper();
    const warmupError = new ApiTransportError({
      requestId: 'req-warmup-reload',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Warm-up failed.',
      },
    });
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    getApplicationAccessMock.mockResolvedValueOnce({ ...GRANTED_ACCESS });
    warmStartupQueriesMock.mockRejectedValueOnce(warmupError);

    render(
      <AppAuthGate>
        <output>Protected content</output>
        <StartupWarmupProbe />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
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
  });

  it('renders children despite a partially failing warm-up cycle', async () => {
    await configureAssignmentDefinitionWarmupFailure();
    const { QueryWrapper } = createQueryWrapper();
    getApplicationAccessMock.mockResolvedValueOnce({ ...GRANTED_ACCESS });

    render(
      <AppAuthGate>
        <AuthStatusCard />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    // A partial warm-up failure (assignment definitions reject) no longer blocks the shell.
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(screen.queryByText('An error occurred. Please try again.')).not.toBeInTheDocument();

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
    // Under the post-admission warm-up model the warm-up snapshot is published to children via
    // the StartupWarmupStateProvider, which is rendered while the cycle is unresolved. The mixed
    // dataset semantics (class datasets ready while assignment definitions fail) remain covered
    // here by mounting the provider directly with a representative snapshot, complementing the
    // uniform-state coverage in startupWarmupState.spec.tsx.
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
    getApplicationAccessMock.mockResolvedValueOnce({ ...GRANTED_ACCESS });
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

  it('reuses an in-flight warm-up cycle across remounts and publishes failed state to children when that shared cycle rejects', async () => {
    const deferredWarmup = createDeferredPromise<void>();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { QueryWrapper, queryClient } = createQueryWrapper();
    getAuthorisationStatusMock.mockResolvedValue(true);
    getApplicationAccessMock.mockResolvedValue({ ...GRANTED_ACCESS });
    warmStartupQueriesMock.mockReturnValue(deferredWarmup.promise);

    const { unmount } = render(
      <AppAuthGate>
        <AuthStatusCard />
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
        <AuthStatusCard />
        <StartupWarmupProbe />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    deferredWarmup.rejectPromise(new Error('Warm-up remount failure.'));

    // The shared rejected cycle no longer blocks the dashboard: children render and the failed
    // warm-up state is published through the warm-up provider.
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
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

    consoleErrorSpy.mockRestore();
  });

  it('preserves the failure auth UI behaviour without starting application access or warm-up', async () => {
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
    expect(getApplicationAccessMock).not.toHaveBeenCalled();
    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });
});
