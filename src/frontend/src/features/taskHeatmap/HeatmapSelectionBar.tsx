/**
 * Selection bar for the standalone Heatmaps builder surface.
 *
 * @remarks
 * Renders the three labelled, controlled selector controls per
 * `HEATMAPS_PAGE_LAYOUT.md` (class → topics → assignments, fixed order):
 *
 * - **Class** — single-select, searchable, `allowClear`, populated from the
 *   warm-up class-partials dataset. Choosing (or clearing) the class is the only
 *   control that drives the dependent selectors' enabled/disabled state.
 * - **Topics / Assignments** — searchable `multiple` Selects presenting
 *   checkbox-style options. They stay disabled until a class is loaded and
 *   expose their disabled reason via a DOM-present `aria-describedby` node (the
 *   green-phase binding directive I2: the reason is discoverable by assistive
 *   tech, never tooltip-only).
 *
 * Option labels are RESOLVED from `assignmentDefinitionPartials`: topic labels
 * use `primaryTopic`, assignment labels use the resolved `primaryTitle`.
 * Assignments whose `definitionKey` has no resolvable partial are omitted, and
 * the assignment set narrows to the active topic selection (cascade). The
 * rendered Checkbox `checked` state is derived from membership of the option's
 * `value` in the surface's controlled selected-values array — antd v6.3.1's
 * `optionRender` exposes NO `selected` flag, so we read `oriOption.value`
 * (pinned by the red contract).
 *
 * The component is declarative and fully controlled by the owning hook
 * (`useHeatmapsPageData`); it holds no selection state of its own.
 *
 * @see HEATMAPS_PAGE_LAYOUT.md
 * @see ACTION_PLAN.md §Section 6
 */

import type { JSX } from 'react';
import { useMemo } from 'react';
import { Checkbox, Flex, Select, Space, Tooltip, Typography } from 'antd';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassPartial } from '../../services/googleClassrooms/classPartialsService';
import type {
  AssignmentDefinitionPartial,
  AssignmentDefinitionPartialsResponse,
} from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { SelectionState } from './selectionCascade';
import { APP_GAP_MD, APP_GAP_SM } from '../../theme/spacing';

/** Accessible reason surfaced when a class has not yet been chosen. */
const DISABLED_REASON = 'Select a class first';

/** Stable DOM id for the disabled-reason description node (I2). */
const DISABLED_REASON_ID = 'heatmap-selection-disabled-reason';

/** Placeholders — action-describing, never auto-selected (SPEC decision 6). */
const CLASS_PLACEHOLDER = 'Select a class';
const TOPICS_PLACEHOLDER = 'Select topics';
const ASSIGNMENTS_PLACEHOLDER = 'Select assignments';

/**
 * Visually-hidden but accessibility-tree-present reason node.
 *
 * Uses the canonical `.sr-only` utility class (centralised in `index.css`) rather
 * than a hand-rolled inline style, so the pattern stays consistent across the app.
 */
const SR_ONLY_CLASS = 'sr-only';

/** Properties for {@link HeatmapSelectionBar}. */
export type HeatmapSelectionBarProperties = Readonly<{
  /** Current selection state (classId / topicKeys / assignmentIds). */
  selection: SelectionState;
  /** Warm-up class-partials dataset (class options); null until ready. */
  classPartials: ClassPartial[] | null;
  /** Warm-up assignment-definition partials (label + topic resolution). */
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null;
  /** Per-class query data; null until a class is selected / loaded. */
  classFull: ClassFull | null;
  /** Select (or clear) the class. */
  onSelectClass: (classId: string | null) => void;
  /** Change the active topic set (clears invalid assignment selections). */
  onChangeTopics: (
    topicKeys: readonly string[],
    assignmentTopicKeys: ReadonlyMap<string, string>
  ) => void;
  /** Change the assignment selection. */
  onChangeAssignments: (assignmentIds: readonly string[]) => void;
}>;

/**
 * Build a key → partial lookup from the warm-up partials dataset.
 *
 * @param {AssignmentDefinitionPartialsResponse | null} partials - The dataset.
 * @returns {Map<string, AssignmentDefinitionPartial>} definitionKey → partial.
 */
function buildPartialsByKey(
  partials: AssignmentDefinitionPartialsResponse | null
): Map<string, AssignmentDefinitionPartial> {
  const map = new Map<string, AssignmentDefinitionPartial>();
  if (partials === null) {
    return map;
  }
  for (const partial of partials) {
    map.set(partial.definitionKey, partial);
  }
  return map;
}

/**
 * Build a map of assignmentId → resolved primaryTopicKey for cascade clearing.
 *
 * @param {ClassFull | null} classFull - The loaded class.
 * @param {Map<string, AssignmentDefinitionPartial>} partialsByKey - Partial lookup.
 * @returns {Map<string, string>} assignmentId → primaryTopicKey (present entries only).
 */
function buildAssignmentTopicKeys(
  classFull: ClassFull | null,
  partialsByKey: Map<string, AssignmentDefinitionPartial>
): Map<string, string> {
  const map = new Map<string, string>();
  if (classFull === null) {
    return map;
  }
  for (const assignment of classFull.assignments) {
    const partial = partialsByKey.get(assignment.assignmentDefinitionKey);
    if (partial !== undefined) {
      map.set(assignment.assignmentId, partial.primaryTopicKey);
    }
  }
  return map;
}

/**
 * Render the three labelled selector controls for the Heatmaps builder surface.
 *
 * @param {HeatmapSelectionBarProperties} properties - Component properties.
 * @returns {JSX.Element} The rendered selection bar.
 */
export function HeatmapSelectionBar({
  selection,
  classPartials,
  assignmentDefinitionPartials,
  classFull,
  onSelectClass,
  onChangeTopics,
  onChangeAssignments,
}: HeatmapSelectionBarProperties): JSX.Element {
  const partialsByKey = useMemo(
    () => buildPartialsByKey(assignmentDefinitionPartials),
    [assignmentDefinitionPartials]
  );

  const assignmentTopicKeys = useMemo(
    () => buildAssignmentTopicKeys(classFull, partialsByKey),
    [classFull, partialsByKey]
  );

  const dependentsDisabled = classFull === null;

  // Disabled-state affordances derived once to keep the JSX branch-free (complexity rule).
  const disabledTooltipTitle = dependentsDisabled ? DISABLED_REASON : undefined;
  const disabledDescribedBy = dependentsDisabled ? DISABLED_REASON_ID : undefined;

  const classOptions = useMemo(() => {
    if (classPartials === null) {
      return [];
    }
    return classPartials
      .map((classPartial) => ({
        value: classPartial.classId,
        label: classPartial.className ?? '(unnamed class)',
      }))
      .toSorted((left, right) => left.label.localeCompare(right.label));
  }, [classPartials]);

  const topicOptions = useMemo(() => {
    if (classFull === null) {
      return [];
    }
    const seen = new Set<string>();
    const collected: { value: string; label: string }[] = [];
    for (const assignment of classFull.assignments) {
      const partial = partialsByKey.get(assignment.assignmentDefinitionKey);
      if (partial === undefined) {
        continue;
      }
      if (seen.has(partial.primaryTopicKey)) {
        continue;
      }
      seen.add(partial.primaryTopicKey);
      collected.push({ value: partial.primaryTopicKey, label: partial.primaryTopic });
    }
    return collected.toSorted((left, right) => left.label.localeCompare(right.label));
  }, [classFull, partialsByKey]);

  const assignmentOptions = useMemo(() => {
    if (classFull === null) {
      return [];
    }
    const activeTopics = new Set(selection.topicKeys);
    const collected: { value: string; label: string }[] = [];
    for (const assignment of classFull.assignments) {
      const partial = partialsByKey.get(assignment.assignmentDefinitionKey);
      if (partial === undefined) {
        continue;
      }
      if (activeTopics.size > 0 && !activeTopics.has(partial.primaryTopicKey)) {
        continue;
      }
      collected.push({ value: assignment.assignmentId, label: partial.primaryTitle });
    }
    // Preserve `ClassFull.assignments` order (layout spec §8.2 forbids re-sorting by
    // title); the cascade filter above already narrows by the active topic set.
    return collected;
  }, [classFull, partialsByKey, selection.topicKeys]);

  const handleTopicsChange = (value: string[]): void => {
    onChangeTopics(value, assignmentTopicKeys);
  };

  return (
    <Flex vertical gap={APP_GAP_MD}>
      {dependentsDisabled && (
        <span id={DISABLED_REASON_ID} className={SR_ONLY_CLASS}>
          {DISABLED_REASON}
        </span>
      )}
      <Flex wrap gap={APP_GAP_MD} align="end">
        <Flex vertical gap={APP_GAP_SM} style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text id="heatmap-class-label">Class</Typography.Text>
          <Select
            aria-labelledby="heatmap-class-label"
            showSearch={{ optionFilterProp: 'label' }}
            allowClear
            placeholder={CLASS_PLACEHOLDER}
            value={
              classOptions.some((option) => option.value === selection.classId)
                ? selection.classId
                : undefined
            }
            loading={selection.classId !== null && classFull === null}
            options={classOptions}
            onChange={(value: string | null) => onSelectClass(value ?? null)}
            style={{ width: '100%' }}
          />
        </Flex>

        <Flex vertical gap={APP_GAP_SM} style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text id="heatmap-topics-label">Topics</Typography.Text>
          <Tooltip title={disabledTooltipTitle}>
            <span style={{ width: '100%' }}>
              <Select
                aria-labelledby="heatmap-topics-label"
                aria-describedby={disabledDescribedBy}
                disabled={dependentsDisabled}
                mode="multiple"
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                maxTagCount="responsive"
                popupMatchSelectWidth={false}
                placeholder={TOPICS_PLACEHOLDER}
                value={[...selection.topicKeys]}
                options={topicOptions}
                onChange={(value: string[]) => handleTopicsChange(value)}
                notFoundContent="No topics available"
                optionRender={(oriOption): JSX.Element => {
                  const checked = selection.topicKeys.includes(String(oriOption.value));
                  return (
                    <Space>
                      <Checkbox checked={checked} aria-checked={checked} />
                      <span>{oriOption.label}</span>
                    </Space>
                  );
                }}
                style={{ width: '100%' }}
              />
            </span>
          </Tooltip>
        </Flex>

        <Flex vertical gap={APP_GAP_SM} style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text id="heatmap-assignments-label">Assignments</Typography.Text>
          <Tooltip title={disabledTooltipTitle}>
            <span style={{ width: '100%' }}>
              <Select
                aria-labelledby="heatmap-assignments-label"
                aria-describedby={disabledDescribedBy}
                disabled={dependentsDisabled}
                mode="multiple"
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                maxTagCount="responsive"
                popupMatchSelectWidth={false}
                placeholder={ASSIGNMENTS_PLACEHOLDER}
                value={[...selection.assignmentIds]}
                options={assignmentOptions}
                onChange={(value: string[]) => onChangeAssignments(value)}
                notFoundContent="No assignments available"
                optionRender={(oriOption): JSX.Element => {
                  const checked = selection.assignmentIds.includes(String(oriOption.value));
                  return (
                    <Space>
                      <Checkbox checked={checked} aria-checked={checked} />
                      <span>{oriOption.label}</span>
                    </Space>
                  );
                }}
                style={{ width: '100%' }}
              />
            </span>
          </Tooltip>
        </Flex>
      </Flex>
    </Flex>
  );
}
