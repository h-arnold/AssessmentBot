/**
 * ClassesPage component tests - Year-group collapse behaviour
 *
 * Mandatory Reading (Files read):
 * - AGENTS.md
 * - src/frontend/AGENTS.md
 * - SPEC.md
 * - CLASSES_PAGE_LAYOUT.md
 * - docs/developer/frontend/frontend-testing.md
 * - docs/developer/frontend/frontend-loading-and-width-standards.md
 * - docs/developer/frontend/frontend-react-query-and-prefetch.md
 * - src/frontend/src/features/auth/startupWarmupState.ts
 * - src/frontend/src/pages/AssignmentsPage.tsx
 * - src/frontend/src/pages/AssignmentsPage.spec.tsx
 * - src/frontend/src/query/sharedQueries.ts
 * - src/frontend/src/query/queryClient.ts
 * - src/frontend/src/test/renderWithFrontendProviders.tsx
 * - src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts
 * - src/frontend/src/pages/PageSection.tsx
 * - src/frontend/src/pages/classes/classesPageModel.ts
 * - src/frontend/src/test/classes/classesPageTestHelpers.ts
 */

import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  renderClassesPage,
  verifyClassesPageModel,
  assertCollapseRegion,
  assertClassCardExists,
  assertPanelHeaderExpanded,
  assertPanelContainsClass,
  MIXED_ORDER_CLASS_PARTIALS,
  MIXED_ORDER_YEAR_GROUPS,
  YEAR_GROUPS_WITH_EMPTY,
  CLASS_PARTIALS_FOR_EMPTY_PANEL,
} from '../../test/classes/classesPageTestHelpers';

import { createReadyWarmupState } from './shared-setup';

const {
  getABClassPartialsMock,
  getYearGroupsMock,
  getCohortsMock,
  getAssignmentTopicsMock,
  getAssignmentDefinitionPartialsMock,
  useStartupWarmupStateMock,
} = vi.hoisted(() => ({
  getABClassPartialsMock: vi.fn(),
  getYearGroupsMock: vi.fn(),
  getCohortsMock: vi.fn(),
  getAssignmentTopicsMock: vi.fn(),
  getAssignmentDefinitionPartialsMock: vi.fn(),
  useStartupWarmupStateMock: vi.fn(),
}));

vi.mock('../../features/auth/startupWarmupState', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actualModule,
    useStartupWarmupState: useStartupWarmupStateMock,
  };
});

vi.mock('../../services/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../../services/referenceDataService', () => ({
  getYearGroups: getYearGroupsMock,
  getCohorts: getCohortsMock,
}));

vi.mock('../../services/assignmentDefinitionPartialsService', () => ({
  getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
}));

vi.mock('../../services/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

describe('ClassesPage', () => {
  beforeEach(() => {
    // Mock all service calls to prevent actual API calls
    getABClassPartialsMock.mockResolvedValue([]);
    getYearGroupsMock.mockResolvedValue([]);
    getCohortsMock.mockResolvedValue([]);
    getAssignmentTopicsMock.mockResolvedValue([]);
    getAssignmentDefinitionPartialsMock.mockResolvedValue([]);

    // Default to ready warmup state
    useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Owned-surface loading, blocking, and page-empty states', () => {
    describe('Section 4: Year-group collapse behaviour', () => {
      // Constants for expected counts
      const EXPECTED_PANEL_COUNT = 3;
      const EXPECTED_DEFAULT_EXPANDED_COUNT = 1;
      const EXPECTED_YEAR_10_CLASSES_COUNT = 2;
      const EXPECTED_YEAR_11_CLASSES_COUNT = 1;
      const EXPECTED_YEAR_9_CLASSES_COUNT = 1;
      const EXPECTED_PANELS_WITH_EMPTY_COUNT = 2;

      // Use shared fixtures from test helpers

      beforeEach(() => {
        useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());
      });

      it('verifies panel header order from a mixed year-group fixture', () => {
        // Use shared helper for rendering with mixed order data
        renderClassesPage({
          classPartials: MIXED_ORDER_CLASS_PARTIALS,
          yearGroups: MIXED_ORDER_YEAR_GROUPS,
        });

        // The view model should sort year groups alphabetically by name
        const { modelResult, isInvalid } = verifyClassesPageModel(
          MIXED_ORDER_CLASS_PARTIALS,
          MIXED_ORDER_YEAR_GROUPS
        );
        expect(modelResult).not.toHaveProperty('type');
        if (!isInvalid && 'panels' in modelResult) {
          expect((modelResult as { panels: unknown[] }).panels).toHaveLength(EXPECTED_PANEL_COUNT);

          // Expected alphabetical order: Year 10, Year 11, Year 9
          const panels = modelResult as { panels: { yearGroupKey: string; yearGroupLabel: string }[] };
          expect(panels.panels[0].yearGroupLabel).toBe('Year 10');
          expect(panels.panels[1].yearGroupLabel).toBe('Year 11');
          expect(panels.panels[2].yearGroupLabel).toBe('Year 9');
        }

        // These tests will fail until the collapse implementation is complete
        // Assert that collapse headers render in the correct alphabetical order
        assertCollapseRegion();

        // Find all collapse panel headers - they should be in alphabetical order
        // This will fail until Ant Design Collapse is implemented with proper panel headers
        const panelHeaders = screen.getAllByRole('heading', { level: 3 });
        expect(panelHeaders).toHaveLength(EXPECTED_PANEL_COUNT);
        expect(panelHeaders[0]).toHaveTextContent('Year 10');
        expect(panelHeaders[1]).toHaveTextContent('Year 11');
        expect(panelHeaders[2]).toHaveTextContent('Year 9');
      });

      it('verifies the first alphabetical panel is open on first ready render', () => {
        // Use shared helper for rendering with mixed order data
        renderClassesPage({
          classPartials: MIXED_ORDER_CLASS_PARTIALS,
          yearGroups: MIXED_ORDER_YEAR_GROUPS,
        });

        // The view model should have the first alphabetical panel as default expanded
        const { modelResult, isInvalid } = verifyClassesPageModel(
          MIXED_ORDER_CLASS_PARTIALS,
          MIXED_ORDER_YEAR_GROUPS
        );
        expect(modelResult).not.toHaveProperty('type');

        if (!isInvalid && 'defaultExpandedPanelKeys' in modelResult) {
          const viewModel = modelResult as { panels: unknown[]; defaultExpandedPanelKeys: string[] };
          expect(viewModel.defaultExpandedPanelKeys).toHaveLength(EXPECTED_DEFAULT_EXPANDED_COUNT);
          // First alphabetical is Year 10
          expect(viewModel.defaultExpandedPanelKeys[0]).toBe('year-group-10');
        }

        // This will fail until the collapse implementation uses defaultActiveKey
        // Assert that the first panel body is visible (expanded)
        assertCollapseRegion();

        // The first panel (Year 10) should have its content visible
        const year10Panel = screen.getByRole('region', { name: /year 10/i });
        expect(year10Panel).toBeInTheDocument();
        // Ant Design's Collapse.Panel header button manages aria-expanded
        assertPanelHeaderExpanded(/year 10/i, true);
      });

      it('verifies an empty year-group panel shows its own empty presentation', () => {
        // Use shared helper for rendering with empty panel data
        renderClassesPage({
          classPartials: CLASS_PARTIALS_FOR_EMPTY_PANEL,
          yearGroups: YEAR_GROUPS_WITH_EMPTY,
        });

        // The view model should create panels for all year groups, even empty ones
        const { modelResult, isInvalid } = verifyClassesPageModel(
          CLASS_PARTIALS_FOR_EMPTY_PANEL,
          YEAR_GROUPS_WITH_EMPTY
        );
        expect(modelResult).not.toHaveProperty('type');

        if (!isInvalid && 'panels' in modelResult) {
          const viewModel = modelResult as { panels: { yearGroupKey: string; classes: unknown[] }[] };
          expect(viewModel.panels).toHaveLength(EXPECTED_PANELS_WITH_EMPTY_COUNT);

          // Year 9 panel should have no classes
          const year9Panel = viewModel.panels.find((p) => p.yearGroupKey === 'year-group-9');
          expect(year9Panel).toBeDefined();
          expect(year9Panel?.classes).toHaveLength(0);
        }

        // This will fail until the in-panel empty presentation is implemented
        // Assert that the empty year group panel shows in-panel empty message
        assertCollapseRegion();

        // The Year 9 panel should show an empty message within its body
        // This will fail until Card-based empty state is implemented
        const year9PanelRegion = screen.getByRole('region', { name: /year 9/i });
        expect(year9PanelRegion).toBeInTheDocument();
        expect(year9PanelRegion).toHaveTextContent(/no classes/i);
      });

      it('verifies cards only render under their matching year-group panel', () => {
        // Use shared helper for rendering with mixed order data
        renderClassesPage({
          classPartials: MIXED_ORDER_CLASS_PARTIALS,
          yearGroups: MIXED_ORDER_YEAR_GROUPS,
        });

        // The view model should group classes by their yearGroupKey
        const { modelResult, isInvalid } = verifyClassesPageModel(
          MIXED_ORDER_CLASS_PARTIALS,
          MIXED_ORDER_YEAR_GROUPS
        );
        expect(modelResult).not.toHaveProperty('type');

        if (!isInvalid && 'panels' in modelResult) {
          const viewModel = modelResult as {
            panels: { yearGroupKey: string; classes: { classId: string; className: string }[] }[]
          };

          // Verify panel structure from view model
          const year10Panel = viewModel.panels.find((p) => p.yearGroupKey === 'year-group-10');
          expect(year10Panel).toBeDefined();
          expect(year10Panel?.classes).toHaveLength(EXPECTED_YEAR_10_CLASSES_COUNT);

          const year11Panel = viewModel.panels.find((p) => p.yearGroupKey === 'year-group-11');
          expect(year11Panel).toBeDefined();
          expect(year11Panel?.classes).toHaveLength(EXPECTED_YEAR_11_CLASSES_COUNT);

          const year9Panel = viewModel.panels.find((p) => p.yearGroupKey === 'year-group-9');
          expect(year9Panel).toBeDefined();
          expect(year9Panel?.classes).toHaveLength(EXPECTED_YEAR_9_CLASSES_COUNT);
        }

        // This will fail until the collapse with cards is implemented
        assertCollapseRegion();

        // Find all class cards
        assertClassCardExists(/mathematics 10a/i);
        assertClassCardExists(/science 9/i);
        assertClassCardExists(/mathematics 11a/i);

        // Verify card-to-panel association
        assertPanelContainsClass(/year 10/i, /mathematics 10a/i);
        assertPanelContainsClass(/year 11/i, /mathematics 11a/i);
        assertPanelContainsClass(/year 9/i, /science 9/i);
      });
    });
  });
});
