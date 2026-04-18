import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';
import { AssignmentsPage } from './AssignmentsPage';

const { useStartupWarmupStateMock } = vi.hoisted(() => ({
  useStartupWarmupStateMock: vi.fn(),
}));

vi.mock('../features/auth/startupWarmupState', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actualModule,
    useStartupWarmupState: useStartupWarmupStateMock,
  };
});

/**
 * Creates a warm-up state with dataset-level startup contracts.
 *
 * @returns {object} Ready and trustworthy startup warm-up state.
 */
function createReadyAssignmentsWarmupState() {
  return {
    isFailed: false,
    isLoading: false,
    isReady: true,
    warmupState: 'ready',
    isDatasetReady: () => true,
    isDatasetFailed: () => false,
    snapshot: {
      datasets: {
        classPartials: { status: 'ready', isTrustworthy: true },
        cohorts: { status: 'ready', isTrustworthy: true },
        yearGroups: { status: 'ready', isTrustworthy: true },
        assignmentDefinitionPartials: { status: 'ready', isTrustworthy: true },
      },
    },
  };
}

describe('AssignmentsPage', () => {
  beforeEach(() => {
    useStartupWarmupStateMock.mockReturnValue(createReadyAssignmentsWarmupState());
  });

  it('blocks the assignments surface when assignmentDefinitionPartials is failed and untrustworthy', () => {
    useStartupWarmupStateMock.mockReturnValue({
      ...createReadyAssignmentsWarmupState(),
      isFailed: true,
      isReady: false,
      warmupState: 'failed',
      isDatasetReady: (datasetKey: string) => datasetKey !== 'assignmentDefinitionPartials',
      isDatasetFailed: (datasetKey: string) => datasetKey === 'assignmentDefinitionPartials',
      snapshot: {
        datasets: {
          classPartials: { status: 'ready', isTrustworthy: true },
          cohorts: { status: 'ready', isTrustworthy: true },
          yearGroups: { status: 'ready', isTrustworthy: true },
          assignmentDefinitionPartials: { status: 'failed', isTrustworthy: false },
        },
      },
    });

    renderWithFrontendProviders(<AssignmentsPage />);

    expect(screen.getByRole('heading', { level: 2, name: 'Assignments' })).toBeInTheDocument();
    expect(
      screen.getByText('Assignment definitions could not be loaded with trustworthy data.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry assignments data' })).toBeInTheDocument();
    expect(screen.queryByText('Track assignment status and upcoming marking tasks.')).not.toBeInTheDocument();
  });

  it('does not block assignments when an unrelated startup dataset fails but assignment definitions stay trusted', () => {
    useStartupWarmupStateMock.mockReturnValue({
      ...createReadyAssignmentsWarmupState(),
      isFailed: true,
      isReady: false,
      warmupState: 'failed',
      isDatasetReady: (datasetKey: string) => datasetKey !== 'classPartials',
      isDatasetFailed: (datasetKey: string) => datasetKey === 'classPartials',
      snapshot: {
        datasets: {
          classPartials: { status: 'failed', isTrustworthy: false },
          cohorts: { status: 'ready', isTrustworthy: true },
          yearGroups: { status: 'ready', isTrustworthy: true },
          assignmentDefinitionPartials: { status: 'ready', isTrustworthy: true },
        },
      },
    });

    renderWithFrontendProviders(<AssignmentsPage />);

    expect(screen.getByRole('heading', { level: 2, name: 'Assignments' })).toBeInTheDocument();
    expect(screen.getByText('Track assignment status and upcoming marking tasks.')).toBeInTheDocument();
    expect(
      screen.queryByText('Assignment definitions could not be loaded with trustworthy data.')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry assignments data' })).not.toBeInTheDocument();
  });

  it('blocks assignments when assignmentDefinitionPartials is untrustworthy even when not failed', () => {
    useStartupWarmupStateMock.mockReturnValue({
      ...createReadyAssignmentsWarmupState(),
      isLoading: true,
      isReady: false,
      warmupState: 'loading',
      isDatasetReady: (datasetKey: string) => datasetKey !== 'assignmentDefinitionPartials',
      isDatasetFailed: () => false,
      snapshot: {
        datasets: {
          classPartials: { status: 'ready', isTrustworthy: true },
          cohorts: { status: 'ready', isTrustworthy: true },
          yearGroups: { status: 'ready', isTrustworthy: true },
          assignmentDefinitionPartials: { status: 'loading', isTrustworthy: false },
        },
      },
    });

    renderWithFrontendProviders(<AssignmentsPage />);

    expect(screen.getByRole('heading', { level: 2, name: 'Assignments' })).toBeInTheDocument();
    expect(
      screen.getByText('Assignment definitions could not be loaded with trustworthy data.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry assignments data' })).toBeInTheDocument();
    expect(screen.queryByText('Track assignment status and upcoming marking tasks.')).not.toBeInTheDocument();
  });
});
