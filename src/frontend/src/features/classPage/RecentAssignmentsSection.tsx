/**
 * The Assignments section for the Class page.
 *
 * Receives the adapter's full newest-first assignment history and renders a
 * section `Card` (`size="small"`, `title="Assignments"`) wrapping:
 * - An accessible Ant Design `Table` (six columns: Name, Completeness,
 *   Accuracy, SPaG, Average and Last Assessed) when `recentAssignments` is
 *   non-empty. Sorting and filtering run over the complete history before the
 *   three-row preview is taken. Initially only the first three matching rows
 *   are shown; when more than three match, a `Card.extra` disclosure button
 *   expands the table to every matching assignment and collapses it again.
 * - An `Empty` component with a CTA button inside the card body when
 *   `recentAssignments` is empty. A filtered table with no matches instead
 *   renders the table's `emptyText`.
 *
 * @remarks
 * Pure presentational component apart from its local disclosure, sort and
 * filter state; it performs no data fetching. The `onStartNewAssessment`
 * callback is passed from the page composition root and is wired to the
 * empty-state CTA button.
 *
 * The card `title` ("Assignments") renders above both the table and the empty
 * state so the section structure is always clear.
 *
 * Table rows are not interactive. Only the assignment names are buttons, and
 * they open the heatmap through `onOpenHeatmap` using native button keyboard
 * activation. When that optional callback is absent the names render as
 * static text.
 *
 * @see SPEC_CLASS_PAGE.md — "RecentAssignmentsSection"
 * @see CLASS_PAGE_LAYOUT.md — "3. Assignments Section"
 */

import type { JSX } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Button, Card, Empty, Table } from 'antd';
import type { TableColumnType, TableColumnsType, TablePaginationConfig } from 'antd';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import { PlusOutlined } from '@ant-design/icons';
import { ChevronsUpDown } from 'lucide-react';
import type { AnalysisMode } from '@/services/dataAnalysis/dataAnalysis.zod';
import type { RecentAssignmentCardModel } from './classPageAdapter.zod';
import { getStudentMetric } from './classPageAdapter.zod';
import { METRIC_DISPLAY_META } from '@/services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { MetricColumnKey } from '@/services/dataAnalysis/metricDisplay/metricDisplayMeta';
import { MetricPill } from '@/services/dataAnalysis/metricDisplay/MetricPill';
import { MetricIconLabel } from '@/components/MetricIconLabel/MetricIconLabel';
import { compareMetricsByStateRank } from '@/services/dataAnalysis/metricDisplay/metricComparator';
import {
  buildMetricRangeFilter,
  isMetricInRange,
} from '@/services/dataAnalysis/metricDisplay/metricRangeFilter';
import { decodeMetricFilter } from '@/services/dataAnalysis/metricDisplay/metricRangeKey';
import { DEFAULT_TONE_RANGE } from '@/services/dataAnalysis/metricDisplay/metricTone';
import { pageContent } from '@/pages/pageContent';

/** Number of rows shown before the disclosure control is used. */
const INITIAL_VISIBLE_ASSIGNMENTS = 3;

/** Stable id of the region controlled by the disclosure button. */
const TABLE_REGION_ID = 'recent-assignments-table-region';

/** Disclosure label while only the initial rows are shown. */
const SHOW_ALL_LABEL = 'Show all assignments';

/** Disclosure label while the full history is shown. */
const SHOW_FEWER_LABEL = 'Show fewer assignments';

/** Fixed order of the four metric columns. */
const METRIC_KEYS = [
  'completeness',
  'accuracy',
  'spag',
  'average',
] as const satisfies readonly MetricColumnKey[];

/** Empty state used when filters exclude every assignment. */
const FILTERED_EMPTY_LOCALE = {
  emptyText: <Empty description={pageContent.classDetail.recentAssignmentsFilteredEmpty} />,
} as const;

/** Columns owning a searchable exact-value filter dropdown. */
type TextFilterColumn = 'assignmentName' | 'lastAssessedAtLabel';

/** Sortable columns: the two text columns plus the four metrics. */
type SortColumn = TextFilterColumn | MetricColumnKey;

/** User-controlled sort direction, mapped from Ant Design's orders. */
type SortDirection = 'asc' | 'desc';

/** Normalised sort state; `null` means the adapter's newest-first order. */
type SortState = Readonly<{
  column: SortColumn;
  direction: SortDirection;
}>;

/** Raw filter keys from Ant Design, one entry per column. */
type AssignmentsFilters = Readonly<
  Record<TextFilterColumn, readonly string[]> & Record<MetricColumnKey, readonly string[]>
>;

/** Initial filter state: every column unfiltered. */
const INITIAL_FILTERS: AssignmentsFilters = {
  assignmentName: [],
  lastAssessedAtLabel: [],
  completeness: [],
  accuracy: [],
  spag: [],
  average: [],
};

type RecentAssignmentsSectionProperties = Readonly<{
  /** The full newest-first assignment history; three matching rows are shown initially. */
  recentAssignments: RecentAssignmentCardModel[];
  /** Callback invoked when the user clicks "Start New Assessment". */
  onStartNewAssessment: () => void;
  /** Optional callback invoked by an assignment-name button to open the heatmap view. */
  onOpenHeatmap?: (assignmentId: string) => void;
  /**
   * The Class page's current analysis mode, forwarded to every metric pill's
   * `excluded` accessible label (§9.27.3 threading chain). Class-page
   * consumers pass it explicitly; when absent the weighting-only wording is
   * used.
   */
  analysisMode?: AnalysisMode;
}>;

/**
 * Read the filter keys for one metric column without a computed object lookup.
 *
 * @param {AssignmentsFilters} filters - The current filter state.
 * @param {MetricColumnKey} key - The metric column.
 * @returns {readonly string[]} The raw encoded keys, empty when unfiltered.
 */
function getMetricFilters(filters: AssignmentsFilters, key: MetricColumnKey): readonly string[] {
  switch (key) {
    case 'completeness': {
      return filters.completeness;
    }
    case 'accuracy': {
      return filters.accuracy;
    }
    case 'spag': {
      return filters.spag;
    }
    case 'average': {
      return filters.average;
    }
  }
}

/**
 * Extract string keys from an Ant Design filter value.
 *
 * @param {FilterValue | null | undefined} value - The raw filter value.
 * @returns {readonly string[]} The string keys, or an empty array.
 */
function normaliseFilterValues(value: FilterValue | null | undefined): readonly string[] {
  if (!value) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * Convert local filter keys to Ant Design's controlled `filteredValue`.
 *
 * @param {readonly string[]} values - The local filter keys.
 * @returns {string[] | null} The controlled value, or `null` when unfiltered.
 */
function toFilteredValue(values: readonly string[]): string[] | null {
  return values.length > 0 ? [...values] : null;
}

/**
 * Normalise a single or array `SorterResult` to the local sort state.
 *
 * @param {SorterResult<RecentAssignmentCardModel> | SorterResult<RecentAssignmentCardModel>[]} sorter -
 *   The sorter result from Ant Design's `onChange`.
 * @returns {SortState | null} The sort state, or `null` when cleared.
 */
function normaliseSorter(
  sorter: SorterResult<RecentAssignmentCardModel> | SorterResult<RecentAssignmentCardModel>[]
): SortState | null {
  const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
  if (!singleSorter?.order || !singleSorter.columnKey) {
    return null;
  }
  return {
    column: singleSorter.columnKey as SortColumn,
    direction: singleSorter.order === 'ascend' ? 'asc' : 'desc',
  };
}

/**
 * Resolve a column's controlled sort indicator from the active sort state.
 *
 * @param {SortState | null} sort - The active sort state.
 * @param {SortColumn} column - The column being resolved.
 * @returns {'ascend' | 'descend' | null} The Ant Design sort order.
 */
function resolveSortOrder(sort: SortState | null, column: SortColumn): 'ascend' | 'descend' | null {
  if (sort?.column !== column) return null;
  return sort.direction === 'asc' ? 'ascend' : 'descend';
}

/**
 * Build a comparator for an explicit sort over the full assignment history.
 *
 * Text columns compare their own value in the requested direction; metric
 * columns delegate to the shared state-aware comparator. Both paths use an
 * ascending `assignmentId` tie-break, regardless of sort direction.
 *
 * @param {SortState} sort - The active sort state.
 * @returns {(a: RecentAssignmentCardModel, b: RecentAssignmentCardModel) => number} The comparator.
 */
function buildComparator(
  sort: SortState
): (a: RecentAssignmentCardModel, b: RecentAssignmentCardModel) => number {
  const { column, direction } = sort;
  if (column !== 'assignmentName' && column !== 'lastAssessedAtLabel') {
    return (a, b): number => {
      return compareMetricsByStateRank(
        getStudentMetric(a.metrics, column),
        getStudentMetric(b.metrics, column),
        a.assignmentId,
        b.assignmentId,
        direction
      );
    };
  }
  return (a, b): number => {
    const primary =
      column === 'assignmentName'
        ? a.assignmentName.localeCompare(b.assignmentName)
        : a.lastAssessedAt.localeCompare(b.lastAssessedAt);
    const ordered = direction === 'asc' ? primary : -primary;
    return ordered || a.assignmentId.localeCompare(b.assignmentId);
  };
}

/**
 * Build searchable exact-value filter options from the full history.
 *
 * @param {string[]} values - Raw values in adapter order.
 * @returns {{ text: string; value: string }[]} Unique filter options.
 */
function buildExactFilters(values: string[]): Array<{ text: string; value: string }> {
  return [...new Set(values)].map((value) => ({ text: value, value }));
}

/**
 * Decide whether a row survives a metric range filter.
 *
 * @param {RecentAssignmentCardModel} row - The row under test.
 * @param {MetricColumnKey} key - The metric column.
 * @param {readonly string[]} activeKeys - The raw encoded filter keys.
 * @returns {boolean} `true` when the row passes.
 */
function isMetricMatchingFilter(
  row: RecentAssignmentCardModel,
  key: MetricColumnKey,
  activeKeys: readonly string[]
): boolean {
  if (activeKeys.length === 0) return true;
  const decoded = decodeMetricFilter(activeKeys[0]);
  if (!decoded) return true;
  return isMetricInRange(getStudentMetric(row.metrics, key), decoded.min, decoded.max, decoded);
}

/**
 * Render the Assignments section.
 *
 * @param {Readonly<RecentAssignmentsSectionProperties>} root0 - Component properties.
 * @param {RecentAssignmentCardModel[]} root0.recentAssignments - The full newest-first assignment history.
 * @param {() => void} root0.onStartNewAssessment - Callback invoked when the user clicks "Start New Assessment".
 * @param {(assignmentId: string) => void} [root0.onOpenHeatmap] - Optional callback invoked by an assignment name.
 * @param {AnalysisMode} [root0.analysisMode] - The page's analysis mode for the pills' excluded labels.
 * @returns {JSX.Element} The Assignments section card.
 */
export function RecentAssignmentsSection({
  recentAssignments,
  onStartNewAssessment,
  onOpenHeatmap,
  analysisMode,
}: RecentAssignmentsSectionProperties): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<SortState | null>(null);
  const [filters, setFilters] = useState<AssignmentsFilters>(INITIAL_FILTERS);

  const matchingAssignments = useMemo(() => {
    const filtered = recentAssignments.filter((row) => {
      return (
        (filters.assignmentName.length === 0 ||
          filters.assignmentName.includes(row.assignmentName)) &&
        (filters.lastAssessedAtLabel.length === 0 ||
          filters.lastAssessedAtLabel.includes(row.lastAssessedAtLabel)) &&
        METRIC_KEYS.every((key) => isMetricMatchingFilter(row, key, getMetricFilters(filters, key)))
      );
    });
    return sort ? filtered.toSorted(buildComparator(sort)) : filtered;
  }, [recentAssignments, filters, sort]);

  const canExpand = matchingAssignments.length > INITIAL_VISIBLE_ASSIGNMENTS;
  const visibleAssignments = expanded
    ? matchingAssignments
    : matchingAssignments.slice(0, INITIAL_VISIBLE_ASSIGNMENTS);
  const disclosureLabel = expanded ? SHOW_FEWER_LABEL : SHOW_ALL_LABEL;

  const handleTableChange = useCallback(
    (
      _pagination: TablePaginationConfig,
      filtersArgument: Record<string, FilterValue | null>,
      sorter: SorterResult<RecentAssignmentCardModel> | SorterResult<RecentAssignmentCardModel>[]
    ): void => {
      setFilters({
        assignmentName: normaliseFilterValues(filtersArgument.assignmentName),
        lastAssessedAtLabel: normaliseFilterValues(filtersArgument.lastAssessedAtLabel),
        completeness: normaliseFilterValues(filtersArgument.completeness),
        accuracy: normaliseFilterValues(filtersArgument.accuracy),
        spag: normaliseFilterValues(filtersArgument.spag),
        average: normaliseFilterValues(filtersArgument.average),
      });
      setSort(normaliseSorter(sorter));
    },
    []
  );

  const columns: TableColumnsType<RecentAssignmentCardModel> = [
    {
      key: 'assignmentName',
      title: 'Name',
      dataIndex: 'assignmentName',
      sorter: true,
      sortOrder: resolveSortOrder(sort, 'assignmentName'),
      filters: buildExactFilters(recentAssignments.map((row) => row.assignmentName)),
      filterSearch: true,
      filteredValue: toFilteredValue(filters.assignmentName),
      render: (name: string, record): JSX.Element => {
        return onOpenHeatmap ? (
          <Button type="link" onClick={() => onOpenHeatmap(record.assignmentId)}>
            {name}
          </Button>
        ) : (
          <span>{name}</span>
        );
      },
    },
    ...METRIC_KEYS.map((key): TableColumnType<RecentAssignmentCardModel> => {
      const meta = METRIC_DISPLAY_META.get(key)!;
      const activeKeys = getMetricFilters(filters, key);
      const labelId = `assignments-metric-label-${key}`;
      const rangeFilter = buildMetricRangeFilter<RecentAssignmentCardModel>({
        range: DEFAULT_TONE_RANGE,
        getMetric: (record) => getStudentMetric(record.metrics, key),
        activeRange: [],
        activeFilterKey: activeKeys[0],
      });
      return {
        key,
        // Ant Design derives `aria-label` only from string titles, so give
        // icon-only titles an explicit name without hiding the filter icon.
        title: (
          <span id={labelId}>
            <MetricIconLabel icon={meta.icon} label={meta.label} />
          </span>
        ),
        onHeaderCell: () => ({ 'aria-labelledby': labelId }),
        align: 'center',
        sorter: true,
        sortOrder: resolveSortOrder(sort, key),
        ...rangeFilter,
        filteredValue: toFilteredValue(activeKeys),
        render: (_value: unknown, record): JSX.Element => {
          return (
            <MetricPill
              metric={getStudentMetric(record.metrics, key)}
              analysisMode={analysisMode}
            />
          );
        },
      };
    }),
    {
      key: 'lastAssessedAtLabel',
      title: 'Last Assessed',
      dataIndex: 'lastAssessedAtLabel',
      sorter: true,
      sortOrder: resolveSortOrder(sort, 'lastAssessedAtLabel'),
      filters: buildExactFilters(recentAssignments.map((row) => row.lastAssessedAtLabel)),
      filterSearch: true,
      filteredValue: toFilteredValue(filters.lastAssessedAtLabel),
    },
  ];

  return (
    <Card
      size="small"
      title="Assignments"
      extra={
        canExpand ? (
          <Button
            type="text"
            size="small"
            icon={<ChevronsUpDown size={16} strokeWidth={1.5} />}
            aria-label={disclosureLabel}
            aria-expanded={expanded}
            aria-controls={TABLE_REGION_ID}
            onClick={() => setExpanded((current) => !current)}
          />
        ) : undefined
      }
    >
      {recentAssignments.length === 0 ? (
        <Empty description={pageContent.classDetail.recentAssignmentsEmpty}>
          <Button type="primary" icon={<PlusOutlined />} onClick={onStartNewAssessment}>
            Start New Assessment
          </Button>
        </Empty>
      ) : (
        <div id={TABLE_REGION_ID}>
          <Table<RecentAssignmentCardModel>
            dataSource={visibleAssignments}
            columns={columns}
            rowKey="assignmentId"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
            aria-label="Assignments"
            onChange={handleTableChange}
            locale={FILTERED_EMPTY_LOCALE}
          />
        </div>
      )}
    </Card>
  );
}
