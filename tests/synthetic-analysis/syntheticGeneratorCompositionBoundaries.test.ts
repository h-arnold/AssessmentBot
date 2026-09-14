import { describe, expect, it } from 'vitest';

import { assertSerialisable } from '../../scripts/synthetic-test-data/invariantGuards.js';
import { generateAssignmentDefinitions } from '../../scripts/synthetic-test-data/generateAssignmentDefinitions.js';
import { generateAssignments } from '../../scripts/synthetic-test-data/generateAssignments.js';
import { generateReferenceData } from '../../scripts/synthetic-test-data/generateReferenceData.js';
import { generateSubmissions } from '../../scripts/synthetic-test-data/generateSubmissions.js';
import { getProfileDefinition } from '../../scripts/synthetic-test-data/profileDefinitions.js';
import { toTransportViews } from '../../scripts/synthetic-test-data/toTransportViews.js';

const SMALL_PROFILE = 'small';
const LARGE_FULL_PROFILE = 'large-full';
const STUDENTS_PER_CLASS = 30;
const PERCENT_SCALE = 100;
const BAND_ZERO_MIN_PERCENT = 20;
const BAND_ZERO_MAX_PERCENT = 49;
const BAND_ONE_MIN_PERCENT = 50;
const BAND_ONE_MAX_PERCENT = 79;

/**
 * Generator-internal observation of the reference-data view. The module carries
 * deliberately loose JSDoc array types, so this spec names the resolvable shape
 * it composes instead of relying on the loose inference.
 */
type GeneratedReferenceData = {
  cohorts: Array<{ key: string }>;
  yearGroups: Array<{ key: string; name: string }>;
  assignmentTopics: Array<{ key: string; name: string; yearGroupKeys: string[] }>;
};

/**
 * Generator-internal observation of the persistence-shaped definitions the
 * assignment generator consumes.
 */
type GeneratedAssignmentDefinitions = Array<{
  definitionKey: string;
  documentType: string;
  tasks: Record<string, unknown> | Array<{ taskId: string; [key: string]: unknown }>;
}>;

/**
 * A compact large-full profile shape. It preserves the canonical profile name so
 * the seeded completion-band path executes, but keeps the roster and assignment
 * counts small so the focused composition test stays fast.
 */
const COMPACT_LARGE_FULL_PROFILE = Object.freeze({
  name: LARGE_FULL_PROFILE,
  seed: 41_064,
  classCount: 1,
  studentsPerClass: STUDENTS_PER_CLASS,
  assignmentsPerClass: 6,
  yearGroupCount: 1,
});

/**
 * A minimal reference-data shape for transport projection boundaries.
 */
const MINIMAL_REFERENCE_DATA = {
  cohorts: [],
  yearGroups: [{ key: 'year-group-7', name: 'Year 7' }],
  assignmentTopics: [],
};

/**
 * A single class with no generated assignments, used to exercise the empty
 * per-class transport assignment fallback.
 */
const MINIMAL_CLASSES = [
  {
    classId: 'class-0',
    className: 'Synthetic Class',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-7',
    classOwner: null,
    teachers: [],
    active: true,
    students: [],
  },
];

/**
 * Builds a persistence-shaped assignment definition for projection tests.
 *
 * @param overrides Fields to override on the base definition.
 * @returns A definition carrying the supplied task wire form.
 */
function buildMinimalDefinition(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    definitionKey: 'definition-keyed',
    primaryTitle: 'Synthetic Definition',
    primaryTopic: 'Synthetic Topic',
    primaryTopicKey: 'topic-0',
    yearGroupKey: 'year-group-7',
    yearGroupLabel: 'Year 7',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'reference-document-0',
    templateDocumentId: 'template-document-0',
    assignmentWeighting: 1,
    tasks: { 'task-a': { taskWeighting: 1 } },
    createdAt: '2024-09-01T00:00:00.000Z',
    updatedAt: '2024-09-01T00:02:00.000Z',
    ...overrides,
  };
}

describe('reference-data generation boundaries', () => {
  it('collapses a topic to a single year-group reference when only one year group exists', () => {
    const referenceData = generateReferenceData({ seed: 1, yearGroupCount: 1 }) as {
      yearGroups: Array<{ key: string }>;
      assignmentTopics: Array<{ yearGroupKeys: string[] }>;
    };

    expect(referenceData.yearGroups).toHaveLength(1);
    expect(referenceData.assignmentTopics.length).toBeGreaterThan(0);
    for (const topic of referenceData.assignmentTopics) {
      expect(topic.yearGroupKeys).toEqual([referenceData.yearGroups[0].key]);
    }
  });
});

describe('large-full submission band composition', () => {
  it('derives large-full completion counts from the seeded band selection', () => {
    const profileDefinition = { ...COMPACT_LARGE_FULL_PROFILE };
    const referenceData = generateReferenceData(profileDefinition) as GeneratedReferenceData;
    const assignmentDefinitions = generateAssignmentDefinitions({
      profileDefinition,
      referenceData,
    }) as GeneratedAssignmentDefinitions;
    const { assignments } = generateAssignments({
      profileDefinition,
      referenceData,
      assignmentDefinitions,
    }) as { assignments: Array<{ submissions: unknown[] }> };

    expect(assignments).toHaveLength(COMPACT_LARGE_FULL_PROFILE.assignmentsPerClass);

    const completionPercents = assignments.map((assignment) =>
      Math.round((assignment.submissions.length / STUDENTS_PER_CLASS) * PERCENT_SCALE)
    );
    for (const [index, percent] of completionPercents.entries()) {
      const isBandOne = index >= 5;
      expect(percent).toBeGreaterThanOrEqual(
        isBandOne ? BAND_ONE_MIN_PERCENT : BAND_ZERO_MIN_PERCENT
      );
      expect(percent).toBeLessThanOrEqual(isBandOne ? BAND_ONE_MAX_PERCENT : BAND_ZERO_MAX_PERCENT);
    }
  });

  it('rejects a large-full assignment index that no completion band covers', () => {
    const profileDefinition = {
      ...COMPACT_LARGE_FULL_PROFILE,
      studentsPerClass: 1,
      assignmentsPerClass: 101,
    };
    const referenceData = generateReferenceData(profileDefinition) as GeneratedReferenceData;
    const assignmentDefinitions = generateAssignmentDefinitions({
      profileDefinition,
      referenceData,
    }) as GeneratedAssignmentDefinitions;

    expect(() =>
      generateAssignments({ profileDefinition, referenceData, assignmentDefinitions })
    ).toThrow(/No large-full completion band covers assignment index 100/u);
  });

  it('rejects class assignment generation when no full definition is available', () => {
    const profileDefinition = getProfileDefinition(SMALL_PROFILE);
    const referenceData = generateReferenceData(profileDefinition) as GeneratedReferenceData;
    const partialOnlyDefinitions = [
      {
        definitionKey: 'definition-partial-only',
        documentType: 'SLIDES',
        tasks: [{ taskId: 'task-partial-0', taskWeighting: 1, taskTitle: 'Partial Task' }],
      },
    ] as GeneratedAssignmentDefinitions;

    expect(() =>
      generateAssignments({
        profileDefinition,
        referenceData,
        assignmentDefinitions: partialOnlyDefinitions,
      })
    ).toThrow(/requires at least one full assignment definition/u);
  });
});

describe('submission roster boundaries', () => {
  it('stops roster iteration when the requested submission count exceeds the roster', () => {
    const submissions = generateSubmissions({
      profileDefinition: getProfileDefinition(SMALL_PROFILE),
      classDocument: {
        classId: 'class-0',
        students: [{ id: 'student-0', name: 'Synthetic Student 0' }],
      },
      assignmentDefinition: { definitionKey: 'definition-0', tasks: { 'task-0': {} } },
      assignmentId: 'assignment-0',
      submissionCount: 3,
      assignmentIndex: 0,
      baseMinuteOffset: 0,
    }) as unknown[];

    expect(submissions).toHaveLength(1);
  });
});

describe('transport projection boundaries', () => {
  it('applies fallback titles and labels for sparse definitions and empty classes', () => {
    const keyedDefinition = buildMinimalDefinition({
      definitionKey: 'definition-keyed',
      yearGroupKey: 'missing-year-group',
      yearGroupLabel: 'Fallback Year Group Label',
      tasks: { 'task-a': { taskWeighting: 1 } },
    });
    const arrayDefinition = buildMinimalDefinition({
      definitionKey: 'definition-array',
      tasks: [{ taskId: 'task-b', taskWeighting: 2 }],
    });

    const views = toTransportViews({
      referenceData: MINIMAL_REFERENCE_DATA,
      classes: MINIMAL_CLASSES,
      assignmentDefinitions: [keyedDefinition, arrayDefinition],
      assignments: [],
    }) as {
      classesById: Record<string, { assignments: unknown[] }>;
      assignmentDefinitionPartials: Array<{
        definitionKey: string;
        yearGroupLabel: string;
        tasks: Array<{ taskId: string; taskTitle: string | null }>;
      }>;
    };

    expect(views.classesById['class-0'].assignments).toEqual([]);

    const keyedPartial = views.assignmentDefinitionPartials.find(
      (definition) => definition.definitionKey === 'definition-keyed'
    );
    const arrayPartial = views.assignmentDefinitionPartials.find(
      (definition) => definition.definitionKey === 'definition-array'
    );

    expect(keyedPartial?.yearGroupLabel).toBe('Fallback Year Group Label');
    expect(arrayPartial?.yearGroupLabel).toBe('Year 7');
    expect(keyedPartial?.tasks[0].taskTitle).toBeNull();
    expect(arrayPartial?.tasks[0].taskTitle).toBeNull();
  });

  it('rejects an assignment that references an undefined definition', () => {
    expect(() =>
      toTransportViews({
        referenceData: MINIMAL_REFERENCE_DATA,
        classes: MINIMAL_CLASSES,
        assignmentDefinitions: [],
        assignments: [
          {
            assignmentId: 'assignment-0',
            courseId: 'class-0',
            assignmentDefinitionKey: 'missing-definition',
          },
        ],
      })
    ).toThrow(/unknown definition "missing-definition"/u);
  });
});

describe('serialisability guard boundaries', () => {
  it('rejects undefined values before serialisation', () => {
    expect(() => assertSerialisable(undefined, 'graph')).toThrow(/is undefined/u);
  });
});
