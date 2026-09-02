/**
 * Selection bar for the standalone Heatmaps builder surface.
 *
 * @remarks
 * Renders the three labelled, controlled selector controls (class → topics → assignments, fixed order):
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
 * @see docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md §9.22
 */

import type { JSX } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Checkbox, Flex, Select, Space, Tooltip, Typography } from 'antd';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassPartial } from '../../services/googleClassrooms/classPartialsService';
import type { AssignmentDefinitionPartialsResponse } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { getAssignmentDefinitionPartial } from '../../services/assignmentDefinition/assignmentDefinitionUtilities';
import { logFrontendEvent } from '../../logging/frontendLogger';
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
 * Build a map of assignmentId → resolved primaryTopicKey for cascade clearing.
 *
 * @param {ClassFull | null} classFull - The loaded class.
 * @param {AssignmentDefinitionPartialsResponse | null} assignmentDefinitionPartials - The
 *   warm-up partials dataset (label + topic resolution).
 * @returns {Map<string, string>} assignmentId → primaryTopicKey (present entries only).
 */
function buildAssignmentTopicKeys(
  classFull: ClassFull | null,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null
): Map<string, string> {
  const map = new Map<string, string>();
  if (classFull === null || assignmentDefinitionPartials === null) {
    return map;
  }
  for (const assignment of classFull.assignments) {
    const partial = getAssignmentDefinitionPartial(
      assignmentDefinitionPartials,
      assignment.assignmentDefinitionKey
    );
    if (partial !== null) {
      map.set(assignment.assignmentId, partial.primaryTopicKey);
    }
  }
  return map;
}

/**
 * Resolve a single assignment to an option entry, or `null` when it must be omitted.
 *
 * @param {ClassFull['assignments'][number]} assignment - The assignment to resolve.
 * @param {ReturnType<typeof getAssignmentDefinitionPartial>} partial - Resolved partial
 *   (or `null` when the `definitionKey` has no resolvable partial).
 * @param {string | undefined} topicKey - Resolved primary topic key (or `undefined`).
 * @param {Set<string>} activeTopics - Currently active topic keys (empty = no filter).
 * @returns {{ value: string; label: string } | null} The option entry, or `null` to omit.
 */
function resolveAssignmentOption(
  assignment: ClassFull['assignments'][number],
  partial: ReturnType<typeof getAssignmentDefinitionPartial>,
  topicKey: string | undefined,
  activeTopics: Set<string>
): { value: string; label: string } | null {
  if (partial === null || topicKey === undefined) {
    return null;
  }
  if (activeTopics.size > 0 && !activeTopics.has(topicKey)) {
    return null;
  }
  return { value: assignment.assignmentId, label: partial.primaryTitle };
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
  const assignmentTopicKeys = useMemo(
    () => buildAssignmentTopicKeys(classFull, assignmentDefinitionPartials),
    [classFull, assignmentDefinitionPartials]
  );

  // Assignments whose `definitionKey` has no resolvable partial are omitted from the
  // topic/assignment selectors; SPEC requires these omissions to be logged as warnings.
  // Guarded on `assignmentDefinitionPartials` being present so we only warn once the
  // warm-up data has resolved (not during the still-loading phase).
  const omittedAssignmentIds = useMemo(() => {
    const ids: string[] = [];
    if (classFull !== null && assignmentDefinitionPartials !== null) {
      for (const assignment of classFull.assignments) {
        const partial = getAssignmentDefinitionPartial(
          assignmentDefinitionPartials,
          assignment.assignmentDefinitionKey
        );
        if (partial === null) {
          ids.push(assignment.assignmentId);
        }
      }
    }
    return ids;
  }, [classFull, assignmentDefinitionPartials]);

  // Idempotency guard: warn for each omitted id only once, even if the memo above
  // recomputes (e.g. on unrelated re-renders), per logging policy §3 (no double-logging).
  const warnedOmittedAssignmentIds = useRef<Set<string>>(new Set<string>());

  useEffect(() => {
    for (const assignmentId of omittedAssignmentIds) {
      if (!warnedOmittedAssignmentIds.current.has(assignmentId)) {
        warnedOmittedAssignmentIds.current.add(assignmentId);
        logFrontendEvent('warn', {
          context: 'HeatmapSelectionBar',
          errorMessage: `Assignment "${assignmentId}" omitted from Heatmaps selectors: no resolvable assignment-definition partial`,
          metadata: { assignmentId },
        });
      }
    }
  }, [omittedAssignmentIds]);

  const dependentsDisabled = classFull === null;

  // Disabled-state affordances derived once to keep the JSX branch-free (complexity rule).
  const disabledTooltipTitle = dependentsDisabled ? DISABLED_REASON : undefined;
  const disabledDescribedBy = dependentsDisabled ? DISABLED_REASON_ID : undefined;

  // Memoised membership sets (P-N4): O(1) `has` lookups in option renders and the
  // class-value selector instead of O(n) `includes`/`some` rescans on every repaint.
  const selectedTopicKeys = useMemo(() => new Set(selection.topicKeys), [selection.topicKeys]);
  const selectedAssignmentIds = useMemo(
    () => new Set(selection.assignmentIds),
    [selection.assignmentIds]
  );

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

  // Memoised membership set (P-N4): O(1) `has` lookup for the class-value selector
  // instead of an O(n) `some` rescan on every repaint. Declared after `classOptions`
  // to satisfy the React Compiler's no-use-before-declaration analysis.
  const classOptionIds = useMemo(
    () => new Set(classOptions.map((option) => option.value)),
    [classOptions]
  );

  const topicOptions = useMemo(() => {
    if (classFull === null || assignmentDefinitionPartials === null) {
      return [];
    }
    const seen = new Set<string>();
    const collected: { value: string; label: string }[] = [];
    for (const assignment of classFull.assignments) {
      const partial = getAssignmentDefinitionPartial(
        assignmentDefinitionPartials,
        assignment.assignmentDefinitionKey
      );
      if (partial === null) {
        continue;
      }
      if (seen.has(partial.primaryTopicKey)) {
        continue;
      }
      seen.add(partial.primaryTopicKey);
      collected.push({ value: partial.primaryTopicKey, label: partial.primaryTopic });
    }
    return collected.toSorted((left, right) => left.label.localeCompare(right.label));
  }, [classFull, assignmentDefinitionPartials]);

  const assignmentOptions = useMemo(() => {
    if (classFull === null || assignmentDefinitionPartials === null) {
      return [];
    }
    const activeTopics = new Set(selection.topicKeys);
    const collected: { value: string; label: string }[] = [];
    for (const assignment of classFull.assignments) {
      const partial = getAssignmentDefinitionPartial(
        assignmentDefinitionPartials,
        assignment.assignmentDefinitionKey
      );
      // The topic key is already resolved by the memoised `assignmentTopicKeys` map
      // (built from the same `getAssignmentDefinitionPartial` lookup); reuse it instead of re-deriving.
      const topicKey = assignmentTopicKeys.get(assignment.assignmentId);
      const option = resolveAssignmentOption(assignment, partial, topicKey, activeTopics);
      if (option !== null) {
        collected.push(option);
      }
    }
    // Preserve `ClassFull.assignments` order (layout spec §8.2 forbids re-sorting by
    // title); the cascade filter above already narrows by the active topic set.
    return collected;
  }, [classFull, assignmentDefinitionPartials, assignmentTopicKeys, selection.topicKeys]);

  const handleTopicsChange = (value: string[]): void => {
    onChangeTopics(value, assignmentTopicKeys);
  };

  return (
    <Flex vertical gap={APP_GAP_MD}>
      {/* Always present in the DOM so the `aria-describedby` target is robustly
          reachable when the dependent controls are disabled (A-N2). */}
      <span id={DISABLED_REASON_ID} className="sr-only">
        {DISABLED_REASON}
      </span>
      <Flex wrap gap={APP_GAP_MD} align="end">
        <Flex vertical gap={APP_GAP_SM} style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text id="heatmap-class-label">Class</Typography.Text>
          <Select
            aria-labelledby="heatmap-class-label"
            showSearch={{ optionFilterProp: 'label' }}
            allowClear
            placeholder={CLASS_PLACEHOLDER}
            value={
              selection.classId !== null && classOptionIds.has(selection.classId)
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
                  const checked = selectedTopicKeys.has(String(oriOption.value));
                  return (
                    <Space>
                      <Checkbox checked={checked} />
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
                  const checked = selectedAssignmentIds.has(String(oriOption.value));
                  return (
                    <Space>
                      <Checkbox checked={checked} />
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
