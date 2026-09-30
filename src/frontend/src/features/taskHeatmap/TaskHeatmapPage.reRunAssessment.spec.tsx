import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { App } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import { mockGetAssignment } from '../../test/taskHeatmapPageMocks';
import {
  analyserResultFixture,
  buildDefaultAssignmentFixture,
  classFullFixture,
  VALID_ASSIGNMENT_PARTIAL,
} from '../../test/taskHeatmapPageFixtures';
import { createTestQueryClient } from '../../test/dataAnalysis/heatmapFixtures';
import { expectReRunButtonOrdering } from '../../test/shared/buttonOrderingTestHelpers';
import { TaskHeatmapPage } from './TaskHeatmapPage';
import type { ReRunContext } from '../shared/reRunAssessmentContext';

/** Heatmap properties overridden by the re-run action specs. */
type ReRunSpecProperties = Readonly<{
  onReRunAssessment?: (context: ReRunContext) => void;
}>;

/**
 * Builds the heatmap page properties from the shared fixtures, with optional
 * overrides for the callback under test.
 *
 * @param {ReRunSpecProperties} [overrides] Properties to override on the fixture page.
 * @returns {object} The complete heatmap page properties.
 */
function buildHeatmapProperties(overrides: ReRunSpecProperties = {}) {
  return {
    analyserResult: analyserResultFixture,
    classFull: classFullFixture,
    assignmentId: 'a-1',
    assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
    onBack: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

/**
 * Renders the heatmap page inside the providers used by this suite.
 *
 * @param {ReRunSpecProperties} [overrides] Properties to override on the fixture page.
 * @returns {void}
 */
function renderHeatmapPage(overrides: ReRunSpecProperties = {}): void {
  render(
    createElement(
      QueryClientProvider,
      { client: createTestQueryClient() },
      createElement(App, null, createElement(TaskHeatmapPage, buildHeatmapProperties(overrides)))
    )
  );
}

beforeEach(() => {
  mockGetAssignment.mockImplementation(() => Promise.resolve(buildDefaultAssignmentFixture()));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('TaskHeatmapPage — Re-run Assessment action', () => {
  it('renders Re-run Assessment and Refresh together when the re-run callback is provided', async () => {
    renderHeatmapPage({ onReRunAssessment: vi.fn() });

    expect(await screen.findByRole('button', { name: /re-run assessment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to class overview/i })).toBeInTheDocument();
  });

  it('places Re-run Assessment immediately left of Refresh with Back to Class overview on the left', async () => {
    renderHeatmapPage({ onReRunAssessment: vi.fn() });
    await screen.findByRole('button', { name: /re-run assessment/i });

    expectReRunButtonOrdering();
  });

  it('invokes onReRunAssessment with the assignment and its linked definition key', async () => {
    const user = userEvent.setup();
    const onReRunAssessment = vi.fn();
    renderHeatmapPage({ onReRunAssessment });

    const reRunButton = await screen.findByRole('button', { name: /re-run assessment/i });
    await user.click(reRunButton);

    expect(onReRunAssessment).toHaveBeenCalledTimes(1);
    expect(onReRunAssessment).toHaveBeenCalledWith({
      assignmentId: 'a-1',
      definitionKey: 'def-1',
    });
  });

  it('omits the Re-run Assessment action when no re-run callback is provided', async () => {
    renderHeatmapPage();

    expect(await screen.findByRole('button', { name: /refresh/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-run assessment/i })).toBeNull();
  });
});
