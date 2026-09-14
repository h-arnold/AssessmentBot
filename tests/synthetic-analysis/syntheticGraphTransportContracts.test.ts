import { describe, expect, it } from 'vitest';

import {
  AssignmentDefinitionPartialsResponseSchema,
  type AssignmentDefinitionPartial,
} from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import {
  ClassFullSchema,
  type ClassFull,
  type StudentSubmissionItemPartial,
} from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod';
import {
  ClassPartialsResponseSchema,
  type ClassPartial,
} from '../../src/frontend/src/services/googleClassrooms/classPartials.zod';
import {
  AssignmentFullSchema,
  type AssignmentFull,
} from '../../src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod';
import type {
  AssignmentTopic,
  Cohort,
  YearGroup,
} from '../../src/frontend/src/services/referenceData/referenceData.zod';
import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';

/** Full-assignment submission item type derived from the production schema. */
type FullAssignmentSubmissionItem = AssignmentFull['submissions'][number]['items'][string];

/**
 * Generator-internal observation of a persistence class document. Persistence is
 * not a frontend Zod contract, so only the fields this spec observes are captured.
 */
type GeneratedClassDocument = {
  classId: string;
  students: Array<{ id: string }>;
};

/**
 * Generator-internal observation of a persistence assignment definition.
 */
type GeneratedDefinitionDocument = {
  definitionKey: string;
  tasks: Record<string, unknown>;
};

/**
 * Generator-internal observation of a persistence assignment record.
 */
type GeneratedAssignmentRecord = {
  courseId: string;
  assignmentId: string;
  assignmentName: string;
};

/**
 * Generator-internal observation of the top-level graph. Transport views are
 * validated and typed through the real frontend schemas; persistence views are
 * observations where no frontend schema applies.
 */
type GeneratedSyntheticAnalysisGraph = {
  manifest: unknown;
  referenceData: {
    cohorts: Cohort[];
    yearGroups: YearGroup[];
    assignmentTopics: AssignmentTopic[];
  };
  persistence: {
    classes: GeneratedClassDocument[];
    assignmentDefinitions: GeneratedDefinitionDocument[];
    assignments: GeneratedAssignmentRecord[];
  };
  transport: {
    classPartials: ClassPartial[];
    assignmentDefinitionPartials: AssignmentDefinitionPartial[];
    classesById: Record<string, ClassFull>;
    assignmentsByKey: Record<string, AssignmentFull>;
  };
};

/**
 * The frontend partial-artefact schema intentionally strips `content` and
 * `contentHash`; the raw generator transport still carries them as redacted
 * nulls. This narrow observation type asserts that redaction without reinstating
 * a duplicate production contract.
 */
type GeneratedPartialArtifactRedaction = {
  content: unknown;
  contentHash: unknown;
};

/**
 * The frontend `AssignmentPartialSchema` strips `courseId` and `assignmentName`,
 * but the backend `Assignment.toPartialJSON()` wire representation retains them.
 * This narrow observation type asserts the raw generated class view keeps both.
 */
type GeneratedPartialAssignmentIdentity = {
  courseId: unknown;
  assignmentId: unknown;
  assignmentName: unknown;
};

const SMALL_PROFILE = 'small';
const MAX_CONTROL_CHARACTER_CODE = 31;
const DELETE_CHARACTER_CODE = 127;
const UNSAFE_PATH_PATTERN = /[\\/]|\.\./u;

const graph = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;

/**
 * Reads the generator-only redaction fields from a partial submission item.
 *
 * @param item A partial submission item from the generator transport.
 * @returns The redaction observation for the item's artefact.
 */
function observePartialArtifact(
  item: StudentSubmissionItemPartial
): GeneratedPartialArtifactRedaction {
  return item.artifact as unknown as GeneratedPartialArtifactRedaction;
}

/**
 * Collects every partial submission item in the class transport views.
 *
 * @param source The logical graph to inspect.
 * @returns The flattened partial submission items.
 */
function collectPartialItems(
  source: GeneratedSyntheticAnalysisGraph
): StudentSubmissionItemPartial[] {
  return Object.values(source.transport.classesById).flatMap((classFull) =>
    classFull.assignments.flatMap((assignment) =>
      assignment.submissions.flatMap((submission) => Object.values(submission.items))
    )
  );
}

/**
 * Collects every full submission item in the assignment transport views.
 *
 * @param source The logical graph to inspect.
 * @returns The flattened full submission items.
 */
function collectFullItems(source: GeneratedSyntheticAnalysisGraph): FullAssignmentSubmissionItem[] {
  return Object.values(source.transport.assignmentsByKey).flatMap((assignment) =>
    assignment.submissions.flatMap((submission) => Object.values(submission.items))
  );
}

/**
 * Walks a value graph and records values that cannot cross the GAS JSON transport.
 *
 * @param value The current value being inspected.
 * @param path A human-readable path used in the reported issues.
 * @param issues The accumulating issue list.
 */
function collectProhibitedValues(value: unknown, path: string, issues: string[]): void {
  if (value === undefined) {
    issues.push(`${path} is undefined`);
    return;
  }
  if (value === null) {
    return;
  }
  if (value instanceof Date) {
    issues.push(`${path} is a live Date`);
    return;
  }

  const valueType = typeof value;
  if (valueType === 'function' || valueType === 'symbol' || valueType === 'bigint') {
    issues.push(`${path} is a ${valueType}`);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectProhibitedValues(entry, `${path}[${index}]`, issues));
    return;
  }

  if (valueType === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      collectProhibitedValues(entry, `${path}.${key}`, issues);
    }
  }
}

/**
 * Reports whether a participant identifier contains a control character.
 *
 * @param value The candidate identifier.
 * @returns True when an ASCII control character is present.
 */
function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= MAX_CONTROL_CHARACTER_CODE || codePoint === DELETE_CHARACTER_CODE)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Collects every generated identifier used by the logical graph so the
 * serialisation safety check covers the full identifier surface rather than a
 * hand-selected subset.
 *
 * @param source The logical graph to inspect.
 * @returns The identifier values that must be transport-safe.
 */
function collectIdentifiers(source: GeneratedSyntheticAnalysisGraph): string[] {
  const identifiers: string[] = [];

  /**
   * Records a contractually nullable identifier only when it is present.
   *
   * @param value The candidate identifier.
   */
  function pushIdentifier(value: string | null | undefined): void {
    if (typeof value === 'string') {
      identifiers.push(value);
    }
  }

  for (const cohort of source.referenceData.cohorts) {
    pushIdentifier(cohort.key);
  }
  for (const yearGroup of source.referenceData.yearGroups) {
    pushIdentifier(yearGroup.key);
  }
  for (const topic of source.referenceData.assignmentTopics) {
    pushIdentifier(topic.key);
    topic.yearGroupKeys.forEach(pushIdentifier);
  }

  for (const classPartial of source.transport.classPartials) {
    pushIdentifier(classPartial.classId);
    pushIdentifier(classPartial.cohortKey);
    pushIdentifier(classPartial.yearGroupKey);
    pushIdentifier(classPartial.classOwner?.userId);
    for (const teacher of classPartial.teachers) {
      pushIdentifier(teacher.userId);
    }
  }

  for (const classFull of Object.values(source.transport.classesById)) {
    pushIdentifier(classFull.classId);
    for (const student of classFull.students) {
      pushIdentifier(student.id);
    }
    for (const assignment of classFull.assignments) {
      pushIdentifier(assignment.assignmentId);
      pushIdentifier(assignment.assignmentDefinitionKey);
      for (const submission of assignment.submissions) {
        pushIdentifier(submission.studentId);
        pushIdentifier(submission.assignmentId);
        pushIdentifier(submission.documentId);
        for (const item of Object.values(submission.items)) {
          pushIdentifier(item.id);
          pushIdentifier(item.taskId);
          pushIdentifier(item.artifact.uid);
          pushIdentifier(item.artifact.taskId);
          pushIdentifier(item.artifact.pageId);
          pushIdentifier(item.artifact.documentId);
        }
      }
    }
  }

  for (const definition of source.transport.assignmentDefinitionPartials) {
    pushIdentifier(definition.definitionKey);
    pushIdentifier(definition.primaryTopicKey);
    pushIdentifier(definition.yearGroupKey);
    pushIdentifier(definition.referenceDocumentId);
    pushIdentifier(definition.templateDocumentId);
    for (const task of definition.tasks) {
      pushIdentifier(task.taskId);
    }
  }

  for (const assignment of Object.values(source.transport.assignmentsByKey)) {
    pushIdentifier(assignment.courseId);
    pushIdentifier(assignment.assignmentId);
    pushIdentifier(assignment.referenceDocumentId);
    pushIdentifier(assignment.templateDocumentId);
    pushIdentifier(assignment.assignmentDefinition.definitionKey);
    pushIdentifier(assignment.assignmentDefinition.referenceDocumentId);
    pushIdentifier(assignment.assignmentDefinition.templateDocumentId);
    for (const task of Object.values(assignment.assignmentDefinition.tasks)) {
      pushIdentifier(task.id);
      for (const artifact of [...task.artifacts.reference, ...task.artifacts.template]) {
        pushIdentifier(artifact.uid);
        pushIdentifier(artifact.documentId);
        pushIdentifier(artifact.pageId);
      }
    }
    for (const submission of assignment.submissions) {
      pushIdentifier(submission.studentId);
      pushIdentifier(submission.assignmentId);
      pushIdentifier(submission.documentId);
      for (const item of Object.values(submission.items)) {
        pushIdentifier(item.id);
        pushIdentifier(item.taskId);
        pushIdentifier(item.artifact.uid);
        pushIdentifier(item.artifact.pageId);
        pushIdentifier(item.artifact.documentId);
      }
    }
  }

  return identifiers;
}

describe('synthetic transport view redaction and identifier retention', () => {
  it('parses every getABClass transport view through the real ClassFull Zod schema', () => {
    expect(Object.keys(graph.transport.classesById).length).toBeGreaterThan(0);

    for (const classFull of Object.values(graph.transport.classesById)) {
      expect(() => ClassFullSchema.parse(classFull)).not.toThrow();
    }
  });

  it('parses every assignment transport view through the real AssignmentFull Zod schema', () => {
    const assignmentsByKey = graph.transport.assignmentsByKey;
    expect(Object.keys(assignmentsByKey).length).toBeGreaterThan(0);

    for (const assignment of Object.values(assignmentsByKey)) {
      expect(() => AssignmentFullSchema.parse(assignment)).not.toThrow();
    }
  });

  it('parses the assignment-definition partials through the real partials Zod schema', () => {
    expect(graph.transport.assignmentDefinitionPartials.length).toBeGreaterThan(0);
    expect(() =>
      AssignmentDefinitionPartialsResponseSchema.parse(graph.transport.assignmentDefinitionPartials)
    ).not.toThrow();
  });

  it('retains semantic identifiers between persistence and transport views', () => {
    const transportDefinitionKeys = new Set(
      AssignmentDefinitionPartialsResponseSchema.parse(
        graph.transport.assignmentDefinitionPartials
      ).map((definition) => definition.definitionKey)
    );
    const persistenceDefinitionKeys = new Set(
      graph.persistence.assignmentDefinitions.map((definition) => definition.definitionKey)
    );

    expect([...transportDefinitionKeys].sort()).toEqual([...persistenceDefinitionKeys].sort());

    const transportClassIds = new Set(Object.keys(graph.transport.classesById));
    const persistenceClassIds = new Set(
      graph.persistence.classes.map((classDocument) => classDocument.classId)
    );
    expect([...transportClassIds].sort()).toEqual([...persistenceClassIds].sort());

    const classPartialIds = new Set(
      ClassPartialsResponseSchema.parse(graph.transport.classPartials).map(
        (classPartial) => classPartial.classId
      )
    );
    expect([...classPartialIds].sort()).toEqual([...transportClassIds].sort());
  });

  it('retains raw class-assignment courseId and assignmentName wire fields', () => {
    const persistenceByAssignmentId = new Map(
      graph.persistence.assignments.map((assignment) => [assignment.assignmentId, assignment])
    );
    let checkedAssignments = 0;

    for (const [classId, classFull] of Object.entries(graph.transport.classesById)) {
      for (const assignment of classFull.assignments) {
        const raw = assignment as unknown as GeneratedPartialAssignmentIdentity;
        const persistenceAssignment = persistenceByAssignmentId.get(raw.assignmentId as string);

        expect(raw.courseId).toBe(classId);
        expect(raw.assignmentName).toBe(persistenceAssignment?.assignmentName);
        expect(typeof raw.assignmentName).toBe('string');
        expect((raw.assignmentName as string).length).toBeGreaterThan(0);
        checkedAssignments += 1;
      }
    }

    expect(checkedAssignments).toBeGreaterThan(0);
  });

  it('redacts artefact content and assessment reasoning in partial views only', () => {
    const partialItems = collectPartialItems(graph);
    expect(partialItems.length).toBeGreaterThan(0);

    for (const item of partialItems) {
      const artifact = observePartialArtifact(item);
      expect(artifact.content).toBeNull();
      expect(artifact.contentHash).toBeNull();
      for (const assessment of Object.values(item.assessments ?? {})) {
        expect('reasoning' in assessment).toBe(false);
      }
    }

    const fullItems = collectFullItems(graph);
    expect(fullItems.some((item) => item.artifact.content !== null)).toBe(true);
    expect(fullItems.some((item) => item.artifact.contentHash !== null)).toBe(true);
    expect(
      fullItems.some((item) =>
        Object.values(item.assessments).some(
          (assessment) => typeof assessment.reasoning === 'string'
        )
      )
    ).toBe(true);
  });
});

describe('synthetic transport JSON serialisation safety', () => {
  it('round-trips the entire logical graph through JSON.stringify and JSON.parse', () => {
    const roundTripped = JSON.parse(JSON.stringify(graph)) as unknown;

    expect(roundTripped).toStrictEqual(graph);
  });

  it('contains no Date, function, symbol, bigint, or undefined transport values', () => {
    const issues: string[] = [];
    collectProhibitedValues(graph, 'graph', issues);

    expect(issues).toEqual([]);
  });

  it('keeps every participant identifier free of path and control characters', () => {
    const identifiers = collectIdentifiers(graph);
    expect(identifiers.length).toBeGreaterThan(0);

    for (const identifier of identifiers) {
      expect(typeof identifier).toBe('string');
      expect(identifier.length).toBeGreaterThan(0);
      expect(UNSAFE_PATH_PATTERN.test(identifier)).toBe(false);
      expect(hasControlCharacters(identifier)).toBe(false);
    }
  });

  it('serialises the full graph in a stable byte-for-byte form for repeated generation', () => {
    const first = JSON.stringify(graph);
    const second = JSON.stringify(
      generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph
    );

    expect(second).toBe(first);
  });
});
