import '@/test/classes/ClassesPage.mockSetup';
import { screen } from '@testing-library/react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetClassesPageComponentMocks,
  useStartupWarmupStateMock,
} from '@/test/classes/classesPageComponentTestSetup';
import { createReadyWarmupState } from '@/test/classes/classesPageWarmupFixtures';
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
} from '../test/classes/classesPageTestHelpers';

beforeEach(() => {
  resetClassesPageComponentMocks();
});
afterEach(() => {
  vi.resetAllMocks();
});

describe('Year-group collapse behaviour', () => {
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

    // The view model should use natural year-group presentation order.
    const { modelResult, isInvalid } = verifyClassesPageModel(
      MIXED_ORDER_CLASS_PARTIALS,
      MIXED_ORDER_YEAR_GROUPS
    );
    expect(modelResult).not.toHaveProperty('type');
    if (!isInvalid && 'panels' in modelResult) {
      expect((modelResult as { panels: unknown[] }).panels).toHaveLength(EXPECTED_PANEL_COUNT);

      // Expected natural order: Year 9, Year 10, Year 11
      const panels = modelResult as {
        panels: { yearGroupKey: string; yearGroupLabel: string }[];
      };
      expect(panels.panels[0].yearGroupLabel).toBe('Year 9');
      expect(panels.panels[1].yearGroupLabel).toBe('Year 10');
      expect(panels.panels[2].yearGroupLabel).toBe('Year 11');
    }

    // These tests will fail until the collapse implementation is complete
    // Assert that collapse headers render in the natural order.
    assertCollapseRegion();

    // Find all collapse panel headers in presentation order.
    // This will fail until Ant Design Collapse is implemented with proper panel headers
    const panelHeaders = screen.getAllByRole('heading', { level: 3 });
    expect(panelHeaders).toHaveLength(EXPECTED_PANEL_COUNT);
    expect(panelHeaders[0]).toHaveTextContent('Year 9');
    expect(panelHeaders[1]).toHaveTextContent('Year 10');
    expect(panelHeaders[2]).toHaveTextContent('Year 11');
  });

  it('verifies the first naturally ordered panel is open on first ready render', () => {
    // Use shared helper for rendering with mixed order data
    renderClassesPage({
      classPartials: MIXED_ORDER_CLASS_PARTIALS,
      yearGroups: MIXED_ORDER_YEAR_GROUPS,
    });

    // The view model should have the first naturally ordered panel expanded by default.
    const { modelResult, isInvalid } = verifyClassesPageModel(
      MIXED_ORDER_CLASS_PARTIALS,
      MIXED_ORDER_YEAR_GROUPS
    );
    expect(modelResult).not.toHaveProperty('type');

    if (!isInvalid && 'defaultExpandedPanelKeys' in modelResult) {
      const viewModel = modelResult as {
        panels: unknown[];
        defaultExpandedPanelKeys: string[];
      };
      expect(viewModel.defaultExpandedPanelKeys).toHaveLength(EXPECTED_DEFAULT_EXPANDED_COUNT);
      expect(viewModel.defaultExpandedPanelKeys[0]).toBe('year-group-9');
    }

    // This will fail until the collapse implementation uses defaultActiveKey
    // Assert that the first panel body is visible (expanded)
    assertCollapseRegion();

    // The first panel (Year 9) should have its content visible.
    const year9Panel = screen.getByRole('region', { name: /year 9/i });
    expect(year9Panel).toBeInTheDocument();
    // Ant Design's Collapse.Panel header button manages aria-expanded
    assertPanelHeaderExpanded(/year 9/i, true);
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
      const viewModel = modelResult as {
        panels: { yearGroupKey: string; classes: unknown[] }[];
      };
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
        panels: { yearGroupKey: string; classes: { classId: string; className: string }[] }[];
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
