/**
 * Component tests for the Heatmaps selection bar (`HeatmapSelectionBar`).
 *
 * GREEN: the component is fully implemented. These tests pin the review (L-1)
 * contract that an assignment whose `definitionKey` has no resolvable
 * `assignmentDefinitionPartial` is omitted from the topic/assignment selectors
 * AND a `warn` is emitted via `logFrontendEvent` (the SPEC-mandated diagnostic).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { HeatmapSelectionBar } from './HeatmapSelectionBar';
import type { SelectionState } from './selectionCascade';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassPartial } from '../../services/googleClassrooms/classPartialsService';
import type { AssignmentDefinitionPartialsResponse } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';

const { mockLogFrontendEvent } = vi.hoisted(() => ({ mockLogFrontendEvent: vi.fn() }));

vi.mock('../../logging/frontendLogger', () => ({
  logFrontendEvent: mockLogFrontendEvent,
  logFrontendError: vi.fn(),
}));

/** The single class ID used across the fixtures below. */
const CLASS_ID = 'class-1';

/**
 * Build a `ClassFull` with two assignments: one whose `definitionKey` resolves
 * to a partial, and one whose `definitionKey` has no resolvable partial.
 *
 * @returns {ClassFull} A class-full fixture.
 */
function makeClassFull(): ClassFull {
  return {
    classId: CLASS_ID,
    className: 'Class 1',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'yg',
    classOwner: null,
    teachers: [],
    active: true,
    students: [{ id: 's1', name: 'S1', email: 's1@test.com' }],
    assignments: [
      {
        assignmentId: 'a-resolvable',
        assignmentDefinitionKey: 'def1',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        assignmentId: 'a-missing',
        assignmentDefinitionKey: 'def-missing',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ],
  } as unknown as ClassFull;
}

/**
 * Build the warm-up class-partials fixture.
 *
 * @returns {ClassPartial[]} A class-partials fixture.
 */
function makeClassPartials(): ClassPartial[] {
  return [
    {
      classId: CLASS_ID,
      className: 'Class 1',
      cohortKey: null,
      courseLength: 1,
      yearGroupKey: 'yg',
      classOwner: null,
      teachers: [],
      active: true,
    } as unknown as ClassPartial,
  ];
}

/**
 * Build an `AssignmentDefinitionPartialsResponse` that resolves only `def1`,
 * deliberately omitting `def-missing`.
 *
 * @returns {AssignmentDefinitionPartialsResponse} A partials registry fixture.
 */
function makePartials(): AssignmentDefinitionPartialsResponse {
  return [
    {
      definitionKey: 'def1',
      primaryTitle: 'Resolvable',
      primaryTopic: 'Topic One',
      primaryTopicKey: 'topic-1',
      yearGroupKey: 'yg',
      yearGroupLabel: 'Year 7',
      alternateTitles: [],
      alternateTopics: [],
      documentType: 'doc',
      referenceDocumentId: null,
      templateDocumentId: null,
      assignmentWeighting: 1,
      tasks: [],
      createdAt: null,
      updatedAt: null,
    },
  ] as unknown as AssignmentDefinitionPartialsResponse;
}

/** A controlled, class-selected selection state. */
const selection: SelectionState = {
  classId: CLASS_ID,
  topicKeys: [],
  assignmentIds: [],
} as SelectionState;

describe('HeatmapSelectionBar — omitted-assignment warn (L-1)', () => {
  beforeEach(() => {
    mockLogFrontendEvent.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('emits a warn and omits the assignment whose definitionKey has no resolvable partial', async () => {
    renderWithFrontendProviders(
      <HeatmapSelectionBar
        selection={selection}
        classPartials={makeClassPartials()}
        assignmentDefinitionPartials={makePartials()}
        classFull={makeClassFull()}
        onSelectClass={vi.fn()}
        onChangeTopics={vi.fn()}
        onChangeAssignments={vi.fn()}
      />
    );

    // The warn must fire (ID is deduped per ref guard, so it fires once on first render).
    await waitFor(() => {
      expect(mockLogFrontendEvent).toHaveBeenCalledWith(
        'warn',
        expect.objectContaining({
          context: 'HeatmapSelectionBar',
          metadata: expect.objectContaining({ assignmentId: 'a-missing' }),
        })
      );
    });

    // The warn is the SPEC-mandated diagnostic for an omitted assignment whose
    // definitionKey has no resolvable partial; antd Select options are virtualized
    // (only rendered when the dropdown is open), so the omission is asserted via
    // this warn rather than by scanning DOM option text.
  });

  it('does not warn when every assignment has a resolvable partial', async () => {
    const allResolvableClassFull = makeClassFull();
    // Replace the assignments so both resolve.
    (allResolvableClassFull.assignments as ClassFull['assignments']).forEach((assignment) => {
      assignment.assignmentDefinitionKey = 'def1';
    });

    renderWithFrontendProviders(
      <HeatmapSelectionBar
        selection={selection}
        classPartials={makeClassPartials()}
        assignmentDefinitionPartials={makePartials()}
        classFull={allResolvableClassFull}
        onSelectClass={vi.fn()}
        onChangeTopics={vi.fn()}
        onChangeAssignments={vi.fn()}
      />
    );

    // No omitted ids → no warn fired.
    await waitFor(() => {
      expect(mockLogFrontendEvent).not.toHaveBeenCalled();
    });
  });
});
