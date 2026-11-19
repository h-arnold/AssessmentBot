import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../query/queryKeys';
import {
  mockTopics,
  mockYearGroups,
  readyAssignmentPartialRows,
} from '../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import type { AssignmentDefinitionPartialRow } from '../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import { createReadyStartupWarmupState } from '../test/assignmentDefinition/wizardTestHelpers';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';
import { AssignmentsPage } from './AssignmentsPage';

const {
  getAssignmentDefinitionPartialsMock,
  getAssignmentDefinitionMock,
  getAssignmentTopicsMock,
  getCohortsMock,
  getYearGroupsMock,
  getABClassPartialsMock,
  upsertAssignmentDefinitionMock,
  useStartupWarmupStateMock,
  refetchAfterStaleInvalidateMock,
} = vi.hoisted(() => {
  return {
    getAssignmentDefinitionPartialsMock: vi.fn(),
    getAssignmentDefinitionMock: vi.fn(),
    getAssignmentTopicsMock: vi.fn(),
    getCohortsMock: vi.fn(),
    getYearGroupsMock: vi.fn(),
    getABClassPartialsMock: vi.fn(),
    upsertAssignmentDefinitionMock: vi.fn(),
    useStartupWarmupStateMock: vi.fn(),
    refetchAfterStaleInvalidateMock: vi.fn(),
  };
});

vi.mock('../features/auth/startupWarmupState', async (importOriginal) => {
  return {
    ...((await importOriginal()) as Record<string, unknown>),
    useStartupWarmupState: useStartupWarmupStateMock,
  };
});

vi.mock('../services/assignmentDefinition/assignmentDefinitionPartialsService', () => {
  return {
    getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
  };
});

vi.mock('../services/assignmentDefinition/assignmentDefinitionService', () => {
  return {
    getAssignmentDefinition: getAssignmentDefinitionMock,
    upsertAssignmentDefinition: upsertAssignmentDefinitionMock,
  };
});

vi.mock('../services/assignmentDefinition/assignmentTopicsService', () => {
  return {
    getAssignmentTopics: getAssignmentTopicsMock,
  };
});

vi.mock('../services/referenceData/referenceDataService', () => {
  return {
    getCohorts: getCohortsMock,
    getYearGroups: getYearGroupsMock,
  };
});

vi.mock('../services/googleClassrooms/classPartialsService', () => {
  return {
    getABClassPartials: getABClassPartialsMock,
  };
});

vi.mock('../query/queryInvalidationHelpers', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;
  refetchAfterStaleInvalidateMock.mockImplementation(
    actualModule.refetchAfterStaleInvalidate as (...arguments_: unknown[]) => unknown
  );
  return { ...actualModule, refetchAfterStaleInvalidate: refetchAfterStaleInvalidateMock };
});

const readyRows: AssignmentDefinitionPartialRow[] = [...readyAssignmentPartialRows];
const REFRESH_BUTTON_NAME = /^Refresh assignments data$/;

/**
 * Finds the refresh button by its exact accessible name.
 *
 * @returns {Promise<HTMLElement>} The refresh button.
 */
async function findRefreshButton(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: REFRESH_BUTTON_NAME });
}

/**
 * Finds an antd `anticon-spin` wrapper within the refresh button. antd's own
 * default loading icon also uses this class and can linger through its leave
 * motion in happy-dom, so this alone does not identify our custom spinner.
 *
 * @param {HTMLElement} button The refresh button.
 * @returns {Element | null} An antd spinning icon, if present.
 */
function getAntdSpinner(button: HTMLElement) {
  return button.querySelector(':scope .anticon-spin');
}

/**
 * Finds the lucide RefreshCw rendered by the button's custom loading icon.
 *
 * @param {HTMLElement} button The refresh button.
 * @returns {Element | null} The custom spinning refresh icon, if present.
 */
function getCustomSpinner(button: HTMLElement) {
  return button.querySelector(':scope .anticon-spin svg.lucide-refresh-cw');
}

describe('AssignmentsPage refresh feedback', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    useStartupWarmupStateMock.mockReturnValue(createReadyStartupWarmupState());
    getAssignmentDefinitionPartialsMock.mockImplementation(() =>
      Promise.resolve([...readyAssignmentPartialRows])
    );
    getAssignmentTopicsMock.mockImplementation(() => Promise.resolve(mockTopics));
    getYearGroupsMock.mockImplementation(() => Promise.resolve(mockYearGroups));
    getCohortsMock.mockImplementation(() => Promise.resolve([]));
    getABClassPartialsMock.mockImplementation(() => Promise.resolve([]));
    upsertAssignmentDefinitionMock.mockImplementation(() => Promise.resolve());
    getAssignmentDefinitionMock.mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows a spinning refresh icon and suppresses repeat clicks while the refetch is in flight', async () => {
    const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
    const refetchQueriesSpy = vi.spyOn(queryClient, 'refetchQueries');
    const refreshButton = await findRefreshButton();

    // The initial query fetch also drives `isFetching`, so wait for it to settle
    // before checking the idle presentation.
    await waitFor(() => {
      expect(refreshButton).not.toHaveClass('ant-btn-loading');
    });
    expect(refreshButton).toBeEnabled();
    expect(getCustomSpinner(refreshButton)).toBeNull();

    const pendingRefetch = Promise.withResolvers<AssignmentDefinitionPartialRow[]>();
    getAssignmentDefinitionPartialsMock.mockImplementation(() => pendingRefetch.promise);

    await user.click(refreshButton);

    await waitFor(() => {
      expect(refreshButton).toHaveClass('ant-btn-loading');
    });
    expect(getAntdSpinner(refreshButton)).not.toBeNull();
    expect(getCustomSpinner(refreshButton)).not.toBeNull();
    expect(screen.getByRole('button', { name: REFRESH_BUTTON_NAME })).toBe(refreshButton);

    const refetchCallCountWhileLoading = refetchQueriesSpy.mock.calls.length;
    await user.click(refreshButton);
    expect(refetchQueriesSpy).toHaveBeenCalledTimes(refetchCallCountWhileLoading);

    await act(async () => {
      pendingRefetch.resolve([...readyRows]);
    });

    await waitFor(() => {
      expect(refreshButton).not.toHaveClass('ant-btn-loading');
    });
    expect(refreshButton).toBeEnabled();
    expect(getCustomSpinner(refreshButton)).toBeNull();
    expect(refreshButton).toHaveTextContent('Refresh assignments data');
  });

  it('clears the spinner and keeps the scoped refetch after the refresh settles', async () => {
    const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
    const refetchQueriesSpy = vi.spyOn(queryClient, 'refetchQueries');
    const refreshButton = await findRefreshButton();

    await waitFor(() => {
      expect(refreshButton).not.toHaveClass('ant-btn-loading');
    });

    const pendingRefetch = Promise.withResolvers<AssignmentDefinitionPartialRow[]>();
    getAssignmentDefinitionPartialsMock.mockImplementation(() => pendingRefetch.promise);

    await user.click(refreshButton);

    await waitFor(() => {
      expect(refreshButton).toHaveClass('ant-btn-loading');
    });
    expect(getAntdSpinner(refreshButton)).not.toBeNull();
    expect(getCustomSpinner(refreshButton)).not.toBeNull();
    expect(refetchAfterStaleInvalidateMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingRefetch.resolve([...readyRows]);
    });

    await waitFor(() => {
      expect(refreshButton).not.toHaveClass('ant-btn-loading');
      expect(refreshButton).toBeEnabled();
    });
    expect(getCustomSpinner(refreshButton)).toBeNull();
    expect(refreshButton).toHaveTextContent('Refresh assignments data');

    expect(refetchQueriesSpy).toHaveBeenCalled();
    for (const [refetchOptions] of refetchQueriesSpy.mock.calls) {
      expect(refetchOptions?.queryKey).toEqual(queryKeys.assignmentDefinitionPartials());
    }
  });
});
