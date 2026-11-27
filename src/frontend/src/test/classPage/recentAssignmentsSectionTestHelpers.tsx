/**
 * Shared fixtures and DOM probes for the Assignments table component specs.
 *
 * Realistic history comes from the committed synthetic corpus through the
 * production Class page adapter. Local rows exercise display boundaries and
 * controlled sort/filter inputs that the corpus does not guarantee.
 */

import { render, screen, within } from '@testing-library/react';
import type { RecentAssignmentCardModel } from '@/features/classPage/classPageAdapter.zod';
import { adaptClassPageToViewModel } from '@/features/classPage/classPageAdapter';
import { RecentAssignmentsSection } from '@/features/classPage/RecentAssignmentsSection';
import { canonicalFullHistoryAdapterInput } from './classPageAdapterTestFixtures';
import {
  createComputedMetricResult,
  createErrorMetricResult,
  createExcludedMetricResult,
  createNotAttemptedMetricResult,
} from '../dataAnalysis/fixtures';
import { requireElement, requireTableElement } from '../shared/domGuards';
import type { MetricColumnKey } from '@/services/dataAnalysis/metricDisplay/metricDisplayMeta';

/** Accessible name of the panel title and the table region. */
export const TABLE_NAME = 'Assignments';

/** Number of rows shown before the disclosure control is used. */
export const INITIAL_VISIBLE_ASSIGNMENTS = 3;

/** Column headings in their fixed display order. */
export const EXPECTED_HEADINGS = [
  'Name',
  'Completeness',
  'Accuracy',
  'SPaG',
  'Average',
  'Last Assessed',
] as const;

/** Fixed order of the four metric columns. */
export const METRIC_KEYS = [
  'completeness',
  'accuracy',
  'spag',
  'average',
] as const satisfies readonly MetricColumnKey[];

/** Zero-based index of every column in the displayed table. */
export const COLUMN_INDEX = {
  name: 0,
  completeness: 1,
  accuracy: 2,
  spag: 3,
  average: 4,
  lastAssessed: 5,
} as const;

/** Lucide class names asserted on each metric header icon. */
export const METRIC_ICON_CLASSES: Readonly<Record<MetricColumnKey, string>> = {
  completeness: 'lucide-list-todo',
  accuracy: 'lucide-target',
  spag: 'lucide-spell-check',
  average: 'lucide-merge',
};

/** Disclosure label while only the initial rows are shown. */
export const SHOW_ALL_ASSIGNMENTS_LABEL = 'Show all assignments';

/** Disclosure label while the full history is shown. */
export const SHOW_FEWER_ASSIGNMENTS_LABEL = 'Show fewer assignments';

/** Computed probe value used by the display-state fixture. */
export const COMPUTED_PROBE_VALUE = 4.2;

/** Display text for {@link COMPUTED_PROBE_VALUE} at Class page precision. */
export const COMPUTED_PROBE_TEXT = '4.20';

/** Expected navigation calls in the heatmap-button test. */
export const EXPECTED_NAVIGATION_CALLS = 2;

const canonicalInput = canonicalFullHistoryAdapterInput();

/** Canonical full assignment history from the committed corpus. */
export const canonicalAssignments: RecentAssignmentCardModel[] =
  adaptClassPageToViewModel(canonicalInput).recentAssignments;

/** Newest-first identity order derived independently from the raw corpus. */
export const expectedHistory = deriveExpectedHistory(canonicalInput);

if (expectedHistory.length <= INITIAL_VISIBLE_ASSIGNMENTS) {
  throw new Error('Canonical fixture must supply more than three assignments');
}

/**
 * Derive assignment identity and newest-first order independently from the raw
 * canonical class and definition registry.
 *
 * @param {ReturnType<typeof canonicalFullHistoryAdapterInput>} input - Canonical input.
 * @returns {Array<{assignmentId: string, assignmentName: string}>} Newest-first identities.
 */
export function deriveExpectedHistory(
  input: ReturnType<typeof canonicalFullHistoryAdapterInput>
): Array<{ assignmentId: string; assignmentName: string }> {
  return input.classFull.assignments
    .toSorted((left, right) => {
      return (
        String(right.updatedAt).localeCompare(String(left.updatedAt)) ||
        left.assignmentId.localeCompare(right.assignmentId)
      );
    })
    .map((assignment) => {
      const definition = input.assignmentDefinitionPartials.find(
        (candidate) => candidate.definitionKey === assignment.assignmentDefinitionKey
      );
      if (!definition) {
        throw new Error(`Canonical definition missing for ${assignment.assignmentDefinitionKey}`);
      }
      return {
        assignmentId: assignment.assignmentId,
        assignmentName: definition.primaryTitle,
      };
    });
}

/**
 * Render the Assignments section with explicit scenario properties.
 *
 * @param {Parameters<typeof RecentAssignmentsSection>[0]} properties - Component properties.
 * @returns {void}
 */
export function renderSection(properties: Parameters<typeof RecentAssignmentsSection>[0]): void {
  render(<RecentAssignmentsSection {...properties} />);
}

/**
 * Resolve the named Assignments table.
 *
 * @returns {HTMLTableElement} The accessible Assignments table.
 */
export function getAssignmentsTable(): HTMLTableElement {
  return requireTableElement(
    screen.getByRole('table', { name: TABLE_NAME }),
    'Expected an accessible Assignments table.'
  );
}

/**
 * Resolve a specific column header by its accessible name.
 *
 * @param {HTMLTableElement} table - The Assignments table.
 * @param {string} name - The column heading text.
 * @returns {HTMLElement} The matching column header.
 */
export function getColumnHeader(table: HTMLTableElement, name: string): HTMLElement {
  return within(table).getByRole('columnheader', {
    // Ant Design sets an explicit aria-label from the title on sortable
    // headers; filter-only headers append "filter" from the trigger icon.
    name: (accessibleName) => accessibleName === name || accessibleName === `${name} filter`,
  });
}

/**
 * Return only data rows, excluding the header and any measurement row.
 *
 * @param {HTMLTableElement} table - The Assignments table.
 * @returns {HTMLElement[]} The rendered data rows.
 */
export function getDataRows(table: HTMLTableElement): HTMLElement[] {
  return within(table)
    .getAllByRole('row')
    .filter((row) => within(row).queryAllByRole('cell').length > 0);
}

/**
 * Return the cells of one row in column order.
 *
 * @param {HTMLElement} row - A table data row.
 * @returns {HTMLElement[]} The row's cells.
 */
export function getRowCells(row: HTMLElement): HTMLElement[] {
  return within(row).getAllByRole('cell');
}

/**
 * Resolve a metric cell by its fixed column position.
 *
 * @param {HTMLElement} row - A table data row.
 * @param {MetricColumnKey} key - The metric key.
 * @returns {HTMLElement} The metric cell.
 */
export function getMetricCell(row: HTMLElement, key: MetricColumnKey): HTMLElement {
  const cell = getRowCells(row)[COLUMN_INDEX[key]];
  return requireElement(cell ?? null, `Expected the ${key} metric cell.`);
}

/**
 * Resolve the shared MetricPill in a metric cell.
 *
 * @param {HTMLElement} row - A table data row.
 * @param {MetricColumnKey} key - The metric key.
 * @returns {HTMLElement} The MetricPill element.
 */
export function getMetricPill(row: HTMLElement, key: MetricColumnKey): HTMLElement {
  return requireElement(
    getMetricCell(row, key).querySelector('.ant-tag'),
    `Expected the ${key} MetricPill.`
  );
}

/**
 * Read assignment-name buttons in rendered row order.
 *
 * @param {HTMLTableElement} table - The Assignments table.
 * @returns {string[]} The rendered assignment names.
 */
export function getRenderedAssignmentNames(table: HTMLTableElement): string[] {
  return getDataRows(table).map((row) => {
    const name = within(row).getByRole('button').textContent?.trim();
    if (!name) {
      throw new TypeError('Expected a rendered assignment name.');
    }
    return name;
  });
}

/**
 * Resolve the disclosure button.
 *
 * @returns {HTMLElement} The title-bar disclosure button.
 */
export function getDisclosureButton(): HTMLElement {
  return screen.getByRole('button', { name: /show (all|fewer) assignments/i });
}

/**
 * Resolve the region referenced by a disclosure button.
 *
 * @param {HTMLElement} button - The disclosure button.
 * @returns {HTMLElement} The controlled region.
 */
export function getDisclosureRegion(button: HTMLElement): HTMLElement {
  const controlsId = button.getAttribute('aria-controls');
  if (!controlsId) {
    throw new TypeError('Expected the disclosure button to name its controlled region.');
  }
  const region =
    [...document.querySelectorAll('[id]')].find((candidate) => candidate.id === controlsId) ?? null;
  return requireElement(region, `Expected controlled region ${controlsId}.`);
}

/**
 * Build a controlled row covering computed, N, E and excluded presentation.
 *
 * @returns {RecentAssignmentCardModel} A canonical row with controlled metric states.
 */
export function buildMetricStateAssignment(): RecentAssignmentCardModel {
  const assignment = canonicalAssignments[0];
  if (!assignment) {
    throw new Error('Canonical fixture must supply an assignment for metric-state probes.');
  }
  // Display boundary: the corpus does not guarantee an excluded per-assignment
  // rollup, so override only the metrics while retaining canonical identity.
  return {
    ...assignment,
    metrics: {
      completeness: createComputedMetricResult({ value: COMPUTED_PROBE_VALUE }),
      accuracy: createNotAttemptedMetricResult(),
      spag: createErrorMetricResult(),
      average: createExcludedMetricResult(),
    },
  };
}

/**
 * Build a controlled row with excluded metrics in every metric column.
 *
 * @returns {RecentAssignmentCardModel} A canonical row with four excluded metrics.
 */
export function buildAllExcludedAssignment(): RecentAssignmentCardModel {
  const assignment = canonicalAssignments[0];
  if (!assignment) {
    throw new Error('Canonical fixture must supply an assignment for exclusion wording probes.');
  }
  // Display boundary: excluded wording must be proved in all four columns even
  // though the corpus does not guarantee four excluded assignment rollups.
  const excluded = createExcludedMetricResult();
  return {
    ...assignment,
    metrics: {
      completeness: excluded,
      accuracy: excluded,
      spag: excluded,
      average: excluded,
    },
  };
}

// ---------------------------------------------------------------------------
// Controlled fixtures for the sort and filter controls
// ---------------------------------------------------------------------------
//
// The corpus cannot express tied sort values, the full N/E/Excluded state
// matrix, or distinct formatted Last Assessed labels (every assignment in the
// selected class shares one calendar date). These fixtures clone canonical
// rows and overwrite only the fields under test.

/** Controlled metric values, one set per canonical row in adapter order. */
const KNOWN_VALUE_SETS = [
  { completeness: 4, accuracy: 1, spag: 2, average: 3 },
  { completeness: 3, accuracy: 2, spag: 4, average: 1 },
  { completeness: 2, accuracy: 3, spag: 1, average: 4 },
  { completeness: 1, accuracy: 4, spag: 3, average: 2 },
] as const satisfies ReadonlyArray<Record<MetricColumnKey, number>>;

/** Controlled names for the name-sort tie-break; the tied rows share "Alpha". */
const TIED_NAMES = ['Zulu', 'Alpha', 'Beta', 'Alpha'] as const;

/** Controlled completeness values for the metric-sort tie-break. */
const HIGHER_TIED_VALUE = 3;
const LOWER_TIED_VALUE = 2;
const LOWEST_TIED_VALUE = 1;
const TIED_COMPLETENESS_VALUES = [
  HIGHER_TIED_VALUE,
  LOWER_TIED_VALUE,
  LOWEST_TIED_VALUE,
  LOWER_TIED_VALUE,
] as const;

/** Controlled completeness states in adapter order: computed, N, E, excluded. */
const COMPUTED_STATE_VALUE = 4;
const METRIC_STATE_VALUES = [COMPUTED_STATE_VALUE, 'N', 'E', 'Excluded'] as const;

/**
 * Require enough canonical rows for a four-row controlled fixture.
 *
 * @returns {RecentAssignmentCardModel[]} The first four canonical rows.
 */
export function requireFourCanonicalRows(): RecentAssignmentCardModel[] {
  if (canonicalAssignments.length < KNOWN_VALUE_SETS.length) {
    throw new Error('Canonical fixture must supply four assignments for control probes.');
  }
  return canonicalAssignments.slice(0, KNOWN_VALUE_SETS.length);
}

/**
 * Read a computed metric's numeric value.
 *
 * @param {RecentAssignmentCardModel['metrics'][MetricColumnKey]} metric - A computed metric.
 * @returns {number} The metric value.
 */
export function computedValue(
  metric: RecentAssignmentCardModel['metrics'][MetricColumnKey]
): number {
  if (metric.state !== 'computed') {
    throw new TypeError('Expected a computed metric for the controlled value probe.');
  }
  return metric.value;
}

/**
 * Build rows with known, distinct values for every metric column.
 *
 * @returns {RecentAssignmentCardModel[]} Four canonical rows with overwritten metrics.
 */
export function buildKnownMetricHistory(): RecentAssignmentCardModel[] {
  return requireFourCanonicalRows().map((row, index) => {
    const values = KNOWN_VALUE_SETS[index]!;
    return {
      ...row,
      metrics: {
        completeness: createComputedMetricResult({ value: values.completeness }),
        accuracy: createComputedMetricResult({ value: values.accuracy }),
        spag: createComputedMetricResult({ value: values.spag }),
        average: createComputedMetricResult({ value: values.average }),
      },
    };
  });
}

/**
 * Derive the preview order expected from a controlled metric sort.
 *
 * @param {RecentAssignmentCardModel[]} rows - Controlled history.
 * @param {MetricColumnKey} key - Sorted metric column.
 * @param {'asc' | 'desc'} direction - Sort direction.
 * @returns {string[]} Expected names in preview order.
 */
export function expectedMetricNames(
  rows: RecentAssignmentCardModel[],
  key: MetricColumnKey,
  direction: 'asc' | 'desc'
): string[] {
  return [...rows]
    .toSorted((left, right) => {
      const difference = computedValue(left.metrics[key]) - computedValue(right.metrics[key]);
      return direction === 'asc' ? difference : -difference;
    })
    .slice(0, INITIAL_VISIBLE_ASSIGNMENTS)
    .map((row) => row.assignmentName);
}

/**
 * Build rows where two names tie but their adapter order opposes ID order.
 *
 * @returns {RecentAssignmentCardModel[]} Four canonical rows with controlled names.
 */
export function buildNameTieHistory(): RecentAssignmentCardModel[] {
  return requireFourCanonicalRows().map((row, index) => {
    return {
      ...row,
      assignmentName: TIED_NAMES[index]!,
    };
  });
}

/**
 * Build rows where two metric values tie but their adapter order opposes ID order.
 *
 * @returns {RecentAssignmentCardModel[]} Four canonical rows with controlled completeness.
 */
export function buildMetricTieHistory(): RecentAssignmentCardModel[] {
  return requireFourCanonicalRows().map((row, index) => {
    return {
      ...row,
      metrics: {
        ...row.metrics,
        completeness: createComputedMetricResult({ value: TIED_COMPLETENESS_VALUES[index]! }),
      },
    };
  });
}

/**
 * Build rows with distinct formatted Last Assessed labels.
 *
 * @returns {RecentAssignmentCardModel[]} Four canonical rows with shifted UTC dates.
 */
export function buildDistinctDateHistory(): RecentAssignmentCardModel[] {
  const first = canonicalAssignments[0];
  if (!first) {
    throw new Error('Canonical fixture must supply an assignment for date probes.');
  }
  const base = new Date(first.lastAssessedAt);
  if (Number.isNaN(base.getTime())) {
    throw new TypeError('Canonical assignment must carry a parseable ISO timestamp.');
  }
  return requireFourCanonicalRows().map((row, index) => {
    const dated = new Date(base);
    dated.setUTCDate(base.getUTCDate() - index);
    return {
      ...row,
      lastAssessedAt: dated.toISOString(),
      lastAssessedAtLabel: dated.toLocaleDateString('en-GB', { timeZone: 'UTC' }),
    };
  });
}

/**
 * Build one controlled metric from a named display state.
 *
 * @param {(typeof METRIC_STATE_VALUES)[number]} state - Controlled state label.
 * @returns {RecentAssignmentCardModel['metrics']['completeness']} The metric result.
 */
function buildStateMetric(
  state: (typeof METRIC_STATE_VALUES)[number]
): RecentAssignmentCardModel['metrics']['completeness'] {
  switch (state) {
    case 'N': {
      return createNotAttemptedMetricResult();
    }
    case 'E': {
      return createErrorMetricResult();
    }
    case 'Excluded': {
      return createExcludedMetricResult();
    }
    default: {
      return createComputedMetricResult({ value: state });
    }
  }
}

/**
 * Build rows covering computed, N, E and excluded completeness states.
 *
 * @returns {RecentAssignmentCardModel[]} Four canonical rows with controlled states.
 */
export function buildMetricStateHistory(): RecentAssignmentCardModel[] {
  return requireFourCanonicalRows().map((row, index) => {
    return {
      ...row,
      metrics: {
        ...row.metrics,
        completeness: buildStateMetric(METRIC_STATE_VALUES[index]!),
      },
    };
  });
}
