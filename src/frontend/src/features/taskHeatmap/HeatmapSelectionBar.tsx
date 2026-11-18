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
 *   tech, never tooltip-only). Both are rendered by the feature-local
 *   `SelectAllDropdownHeader`, which owns the controlled search query and the
 *   select-all / select-none header for each control (#342).
 *
 * Option labels are RESOLVED from `assignmentDefinitionPartials`: topic labels
 * use `primaryTopic`, assignment labels use the resolved `primaryTitle`.
 * Assignments whose `definitionKey` has no resolvable partial are omitted, and
 * the assignment set narrows to the active topic selection (cascade).
 *
 * The component is declarative and fully controlled by the owning hook
 * (`useHeatmapsPageData`); it holds no selection state of its own.
 *
 * @see docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md §9.19/§9.33
 */

import type { JSX } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Flex, Select, Tooltip, Typography } from 'antd';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassPartial } from '@/services/googleClassrooms/classPartialsService';
import type { AssignmentDefinitionPartialsResponse } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { getAssignmentDefinitionPartial } from '@/services/assignmentDefinition/assignmentDefinitionUtilities';
import { pageContent } from '@/pages/pageContent';
import { logFrontendEvent } from '@/logging/frontendLogger';
import type { SelectionState } from './selectionCascade';
import { SelectAllDropdownHeader } from './SelectAllDropdownHeader';
import { APP_GAP_MD, APP_GAP_SM } from '@/theme/spacing';

/** Stable DOM id for the disabled-reason description node (I2). */
const DISABLED_REASON_ID = 'heatmap-selection-disabled-reason';

/** Placeholders — action-describing, never auto-selected. */
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
 * One class assignment paired with its resolved warm-up definition partial.
 *
 * @remarks
 * `partial` is `null` when the assignment's `definitionKey` has no resolvable
 * partial; such assignments are omitted from the selectors and warned about.
 */
type AssignmentPartialEntry = Readonly<{
  assignmentId: string;
  partial: ReturnType<typeof getAssignmentDefinitionPartial>;
}>;

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
  // Single O(A) pass: resolve each assignment's definition partial exactly once, then
  // derive every selector input below from this ordered entry list. Guarded on
  // `assignmentDefinitionPartials` being present so resolution happens only once the
  // warm-up data has resolved (not during the still-loading phase).
  const assignmentPartialEntries = useMemo<AssignmentPartialEntry[]>(() => {
    if (classFull === null || assignmentDefinitionPartials === null) {
      return [];
    }
    return classFull.assignments.map((assignment) => {
      return {
        assignmentId: assignment.assignmentId,
        partial: getAssignmentDefinitionPartial(
          assignmentDefinitionPartials,
          assignment.assignmentDefinitionKey
        ),
      };
    });
  }, [classFull, assignmentDefinitionPartials]);

  // Map of assignmentId → resolved primaryTopicKey for the cascade clear path.
  const assignmentTopicKeys = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of assignmentPartialEntries) {
      if (entry.partial !== null) {
        map.set(entry.assignmentId, entry.partial.primaryTopicKey);
      }
    }
    return map;
  }, [assignmentPartialEntries]);

  // Assignments whose `definitionKey` has no resolvable partial are omitted from the
  // topic/assignment selectors; SPEC requires these omissions to be logged as warnings.
  const omittedAssignmentIds = useMemo(() => {
    return assignmentPartialEntries
      .filter((entry) => entry.partial === null)
      .map((entry) => entry.assignmentId);
  }, [assignmentPartialEntries]);

  // Idempotency guard: warn for each omitted id only once, even if the memo above
  // recomputes (e.g. on unrelated re-renders), per logging policy §3 (no double-logging).
  const warnedOmittedAssignmentIds = useRef<Set<string>>(new Set<string>());

  useEffect(() => {
    for (const assignmentId of omittedAssignmentIds) {
      if (warnedOmittedAssignmentIds.current.has(assignmentId)) {
        continue;
      }
      warnedOmittedAssignmentIds.current.add(assignmentId);
      logFrontendEvent('warn', {
        context: 'HeatmapSelectionBar',
        errorMessage: `Assignment "${assignmentId}" omitted from Heatmaps selectors: no resolvable assignment-definition partial`,
        metadata: { assignmentId },
      });
    }
  }, [omittedAssignmentIds]);

  const areDependentsDisabled = classFull === null;

  // Disabled-state affordances derived once to keep the JSX branch-free (complexity rule).
  const disabledTooltipTitle = areDependentsDisabled
    ? pageContent.heatmaps.selectionDisabledReason
    : undefined;
  const disabledDescribedBy = areDependentsDisabled ? DISABLED_REASON_ID : undefined;

  const classOptions = useMemo(() => {
    if (classPartials === null) {
      return [];
    }
    return classPartials
      .map((classPartial) => {
        return {
          value: classPartial.classId,
          label: classPartial.className ?? '(unnamed class)',
        };
      })
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
    const seen = new Set<string>();
    const collected: { value: string; label: string }[] = [];
    for (const entry of assignmentPartialEntries) {
      if (entry.partial === null || seen.has(entry.partial.primaryTopicKey)) {
        continue;
      }
      seen.add(entry.partial.primaryTopicKey);
      collected.push({
        value: entry.partial.primaryTopicKey,
        label: entry.partial.primaryTopic,
      });
    }
    return collected.toSorted((left, right) => left.label.localeCompare(right.label));
  }, [assignmentPartialEntries]);

  const assignmentOptions = useMemo(() => {
    const activeTopics = new Set(selection.topicKeys);
    const collected: { value: string; label: string }[] = [];
    for (const entry of assignmentPartialEntries) {
      if (entry.partial === null) {
        continue;
      }
      const topicKey = entry.partial.primaryTopicKey;
      if (activeTopics.size > 0 && !activeTopics.has(topicKey)) {
        continue;
      }
      collected.push({ value: entry.assignmentId, label: entry.partial.primaryTitle });
    }
    // Preserve `ClassFull.assignments` order (layout spec §8.2 forbids re-sorting by
    // title); the cascade filter above already narrows by the active topic set.
    return collected;
  }, [assignmentPartialEntries, selection.topicKeys]);

  const handleTopicsChange = (value: string[]): void => {
    onChangeTopics(value, assignmentTopicKeys);
  };

  return (
    <Flex vertical gap={APP_GAP_MD}>
      {/* Always present in the DOM so the `aria-describedby` target is
          reachable when the dependent controls are disabled (A-N2). */}
      <span id={DISABLED_REASON_ID} className="sr-only">
        {pageContent.heatmaps.selectionDisabledReason}
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
            onChange={(value: string | null = null) => onSelectClass(value)}
            style={{ width: '100%' }}
          />
        </Flex>

        <Flex vertical gap={APP_GAP_SM} style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text id="heatmap-topics-label">Topics</Typography.Text>
          <Tooltip title={disabledTooltipTitle}>
            <span style={{ width: '100%' }}>
              <SelectAllDropdownHeader
                labelledBy="heatmap-topics-label"
                describedBy={disabledDescribedBy}
                disabled={areDependentsDisabled}
                placeholder={TOPICS_PLACEHOLDER}
                notFoundContent="No topics available"
                controlName="topics"
                options={topicOptions}
                selectedValues={selection.topicKeys}
                onSelectionChange={handleTopicsChange}
              />
            </span>
          </Tooltip>
        </Flex>

        <Flex vertical gap={APP_GAP_SM} style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text id="heatmap-assignments-label">Assignments</Typography.Text>
          <Tooltip title={disabledTooltipTitle}>
            <span style={{ width: '100%' }}>
              <SelectAllDropdownHeader
                labelledBy="heatmap-assignments-label"
                describedBy={disabledDescribedBy}
                disabled={areDependentsDisabled}
                placeholder={ASSIGNMENTS_PLACEHOLDER}
                notFoundContent="No assignments available"
                controlName="assignments"
                options={assignmentOptions}
                selectedValues={selection.assignmentIds}
                onSelectionChange={onChangeAssignments}
              />
            </span>
          </Tooltip>
        </Flex>
      </Flex>
    </Flex>
  );
}
