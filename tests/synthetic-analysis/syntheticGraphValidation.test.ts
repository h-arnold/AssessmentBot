import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import { validateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/validateSyntheticAnalysisGraph.js';
import { assertCompletionBands } from '../../scripts/synthetic-test-data/validateProfileInvariants.js';
import {
  type AssignmentPartial,
  type ClassFull,
  type StudentSubmissionItemPartial,
} from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartial } from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassPartial } from '../../src/frontend/src/services/googleClassrooms/classPartials.zod';

/**
 * Generator-internal observation of a persistence class document.
 */
type GeneratedClassDocument = {
  classId: string;
  cohortKey: string | null;
  yearGroupKey: string | null;
  students: Array<{ id: string }>;
};

/**
 * Generator-internal observation of the mutable clone this spec perturbs. Transport
 * views are typed against the real frontend service contracts; persistence and
 * reference views are observations where no frontend schema applies.
 */
type MutableGraph = {
  manifest: {
    generatedEntityCounts: Record<string, number>;
  };
  transport: {
    classPartials: ClassPartial[];
    assignmentDefinitionPartials: AssignmentDefinitionPartial[];
    classesById: Record<string, ClassFull>;
    assignmentsByKey: Record<string, unknown>;
  };
  referenceData: unknown;
  persistence: {
    classes: GeneratedClassDocument[];
    assignments: Array<{ courseId: string; assignmentId: string }>;
  };
};

/**
 * The frontend partial-artefact schema intentionally strips `content`; the raw
 * generator transport still carries it as a redacted null. This narrow observation
 * type lets the spec prove the validator rejects unredacted content without
 * reinstating a duplicate production contract.
 */
type GeneratedPartialArtifactRedaction = {
  content: unknown;
};

const SMALL_PROFILE = 'small';

/**
 * Creates a fresh, locally mutable copy of the generated graph.
 *
 * @returns A mutable copy of the small-profile logical graph.
 */
function createMutableGraph(): MutableGraph {
  return structuredClone(generateSyntheticAnalysisGraph(SMALL_PROFILE)) as MutableGraph;
}

/**
 * Returns the first class ID present in the class transport view.
 *
 * @param graph The mutable graph under test.
 * @returns The first class ID.
 */
function firstClassId(graph: MutableGraph): string {
  const classId = Object.keys(graph.transport.classesById)[0];
  if (classId === undefined) {
    throw new Error('Expected at least one generated class');
  }
  return classId;
}

/**
 * Returns the first submission item in the class transport view.
 *
 * @param graph The mutable graph under test.
 * @returns The first partial submission item.
 */
function firstPartialItem(graph: MutableGraph): StudentSubmissionItemPartial {
  const classFull = graph.transport.classesById[firstClassId(graph)];
  for (const assignment of classFull.assignments) {
    for (const submission of assignment.submissions) {
      const item = Object.values(submission.items)[0];
      if (item !== undefined) {
        return item;
      }
    }
  }
  throw new Error('Expected at least one generated submission item');
}

/**
 * Returns the first assignment that carries at least one submission.
 *
 * @param graph The mutable graph under test.
 * @returns The first class assignment with a submission.
 */
function firstAssignmentWithSubmission(graph: MutableGraph): AssignmentPartial {
  const classFull = graph.transport.classesById[firstClassId(graph)];
  const assignment = classFull.assignments.find((candidate) => candidate.submissions.length > 0);
  if (assignment === undefined) {
    throw new Error('Expected at least one generated assignment submission');
  }
  return assignment;
}

describe('synthetic analysis graph validation', () => {
  it('accepts a valid small-profile graph', () => {
    const graph = generateSyntheticAnalysisGraph(SMALL_PROFILE) as unknown;

    expect(() => validateSyntheticAnalysisGraph(graph)).not.toThrow();
  });

  it('rejects an unresolvable class year-group reference with an actionable message', () => {
    const graph = createMutableGraph();
    const classId = firstClassId(graph);
    graph.transport.classesById[classId].yearGroupKey = 'year-group-not-generated';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/year-group-not-generated/u);
  });

  it('rejects a class assignment that references an unknown definition key', () => {
    const graph = createMutableGraph();
    const classId = firstClassId(graph);
    const assignment = graph.transport.classesById[classId].assignments[0];
    assignment.assignmentDefinitionKey = 'definition-not-generated';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/definition-not-generated/u);
  });

  it('rejects a submission that references a student outside the class roster', () => {
    const graph = createMutableGraph();
    const assignment = firstAssignmentWithSubmission(graph);
    assignment.submissions[0].studentId = 'student-not-on-roster';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/student-not-on-roster/u);
  });

  it('rejects a submission item that references an undeclared task ID', () => {
    const graph = createMutableGraph();
    const item = firstPartialItem(graph);
    item.taskId = 'task-not-declared';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/task-not-declared/u);
  });

  it('rejects duplicate student identifiers inside a single class roster', () => {
    const graph = createMutableGraph();
    const classFull = graph.transport.classesById[firstClassId(graph)];
    expect(classFull.students.length).toBeGreaterThanOrEqual(2);
    classFull.students[1].id = classFull.students[0].id;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/duplicate/u);
  });

  it('rejects artefact content that was not redacted from a partial view', () => {
    const graph = createMutableGraph();
    const item = firstPartialItem(graph);
    (item.artifact as unknown as GeneratedPartialArtifactRedaction).content = 'unredacted-content';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/unredacted-content/u);
  });

  it('reports the first detected invariant failure rather than throwing an opaque error', () => {
    const graph = createMutableGraph();
    const classFull = graph.transport.classesById[firstClassId(graph)];
    classFull.yearGroupKey = null;

    let message = '';
    try {
      validateSyntheticAnalysisGraph(graph);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message.length).toBeGreaterThan(0);
    expect(message).toMatch(/yearGroupKey/u);
  });
});

describe('synthetic analysis graph serialisation and profile-count validation', () => {
  it('rejects a live Date transport value with an actionable serialisation error', () => {
    const graph = createMutableGraph();
    firstPartialItem(graph).artifact.metadata = {
      generatedAt: new Date('2024-01-01T00:00:00.000Z'),
    };

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/Date/u);
  });

  it('rejects a function transport value with an actionable serialisation error', () => {
    const graph = createMutableGraph();
    firstPartialItem(graph).artifact.metadata = {
      computeScore: () => 0,
    };

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/function/u);
  });

  it('rejects a manifest that misdeclares a generated entity count', () => {
    const graph = createMutableGraph();
    graph.manifest.generatedEntityCounts.classes = graph.persistence.classes.length + 1;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/class/u);
  });

  it('rejects an actual class count that violates the profile definition', () => {
    const graph = createMutableGraph();
    graph.persistence.classes.pop();

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/class/u);
  });
});

describe('synthetic analysis transport view presence and corruption', () => {
  /**
   * Narrow observation of a generated full-assignment transport entry. No
   * frontend schema is needed because the spec only mutates identifiers.
   */
  type GeneratedFullAssignment = {
    assignmentId: string;
    courseId: string;
    assignmentDefinition: { definitionKey: string };
  };

  /**
   * Creates a fresh mutable graph with one named transport view removed entirely.
   *
   * @param viewName The transport view to delete.
   * @returns A mutable small-profile graph missing the named view.
   */
  function createGraphWithoutTransportView(
    viewName: keyof MutableGraph['transport']
  ): MutableGraph {
    const graph = createMutableGraph();
    delete (graph.transport as Partial<MutableGraph['transport']>)[viewName];
    return graph;
  }

  /**
   * Reads the first key of the full assignment transport view.
   *
   * @param graph The mutable graph under test.
   * @returns The first assignment key.
   */
  function firstFullAssignmentKey(graph: MutableGraph): string {
    const key = Object.keys(graph.transport.assignmentsByKey)[0];
    if (key === undefined) {
      throw new Error('Expected at least one generated full assignment');
    }
    return key;
  }

  it.each([
    ['classPartials'],
    ['assignmentDefinitionPartials'],
    ['classesById'],
    ['assignmentsByKey'],
  ] as const)('rejects a graph missing the %s transport view', (viewName) => {
    const graph = createGraphWithoutTransportView(viewName);

    let message = '';
    try {
      validateSyntheticAnalysisGraph(graph);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(viewName);
  });

  it('rejects a classPartials entry that is not an object', () => {
    const graph = createMutableGraph();
    (graph.transport.classPartials as unknown[])[0] = null;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/entries must be objects/u);
  });

  it('rejects duplicate class identifiers in the classPartials view', () => {
    const graph = createMutableGraph();
    graph.transport.classPartials[1].classId = graph.transport.classPartials[0].classId;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/duplicate classId/u);
  });

  it('rejects a classPartials entry that does not resolve to a persistence class', () => {
    const graph = createMutableGraph();
    graph.transport.classPartials[0].classId = 'class-not-generated';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/class-not-generated/u);
  });

  it('rejects an assignmentDefinitionPartials entry that does not resolve to a persistence definition', () => {
    const graph = createMutableGraph();
    graph.transport.assignmentDefinitionPartials[0].definitionKey = 'definition-not-generated';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/definition-not-generated/u);
  });

  it('rejects an assignmentsByKey view that omits a persistence full assignment', () => {
    const graph = createMutableGraph();
    delete graph.transport.assignmentsByKey[firstFullAssignmentKey(graph)];

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/full assignments/u);
  });

  it('rejects an assignmentsByKey entry whose assignmentId does not match its key', () => {
    const graph = createMutableGraph();
    const entry = graph.transport.assignmentsByKey[firstFullAssignmentKey(graph)] as
      GeneratedFullAssignment | undefined;
    if (entry === undefined) {
      throw new Error('Expected a generated full assignment');
    }
    entry.assignmentId = 'assignment-mismatched';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/does not match/u);
  });

  it('rejects an assignmentsByKey entry whose courseId does not resolve', () => {
    const graph = createMutableGraph();
    const entry = graph.transport.assignmentsByKey[firstFullAssignmentKey(graph)] as
      GeneratedFullAssignment | undefined;
    if (entry === undefined) {
      throw new Error('Expected a generated full assignment');
    }
    entry.courseId = 'class-not-generated';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/courseId/u);
  });

  it('rejects an assignmentsByKey entry that does not preserve the persistence definition key', () => {
    const graph = createMutableGraph();
    const entry = graph.transport.assignmentsByKey[firstFullAssignmentKey(graph)] as
      GeneratedFullAssignment | undefined;
    if (entry === undefined) {
      throw new Error('Expected a generated full assignment');
    }
    entry.assignmentDefinition.definitionKey = 'definition-not-generated';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/definitionKey/u);
  });

  it('rejects an assignmentsByKey entry that does not resolve to a persistence assignment', () => {
    const graph = createMutableGraph();
    const firstKey = firstFullAssignmentKey(graph);
    const entry = graph.transport.assignmentsByKey[firstKey];
    delete graph.transport.assignmentsByKey[firstKey];
    graph.transport.assignmentsByKey['assignment-not-generated'] = entry;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/assignment-not-generated/u);
  });
});

describe('synthetic analysis profile shape invariants', () => {
  it('rejects a class whose roster size violates the profile definition', () => {
    const graph = createMutableGraph();
    graph.persistence.classes[0].students.pop();
    graph.manifest.generatedEntityCounts.students -= 1;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/students/u);
  });

  it('rejects a class whose assignment count violates the profile definition', () => {
    const graph = createMutableGraph();
    graph.persistence.assignments.pop();
    graph.manifest.generatedEntityCounts.assignments -= 1;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/assignments/u);
  });

  it('rejects an uneven Year Group distribution', () => {
    const graph = createMutableGraph();
    graph.persistence.classes[1].yearGroupKey = graph.persistence.classes[0].yearGroupKey;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/Year Group/u);
  });
});

describe('synthetic analysis completion-band invariant', () => {
  /**
   * Narrow observation of the class transport view consumed by the completion
   * band helper. No frontend schema models this helper input, so the spec builds
   * the minimal shape the helper derives completion from.
   */
  type CompletionClassView = {
    students: Array<{ id: string }>;
    assignments: Array<{ assignmentId: string; submissions: unknown[] }>;
  };

  const UNIT_BANDS = [
    { sharePercent: 1, minCompletedPercent: 20, maxCompletedPercent: 49 },
    { sharePercent: 1, minCompletedPercent: 50, maxCompletedPercent: 79 },
    { sharePercent: 1, minCompletedPercent: 80, maxCompletedPercent: 95 },
    { sharePercent: 1, minCompletedPercent: 96, maxCompletedPercent: 100 },
  ];

  /**
   * Builds a single class transport view with the supplied submission counts.
   *
   * @param submissionCounts The number of submissions to place on each assignment.
   * @returns A minimal class transport view for the completion-band helper.
   */
  function createCompletionClassView(submissionCounts: number[]): CompletionClassView {
    return {
      students: [
        { id: 'student-0' },
        { id: 'student-1' },
        { id: 'student-2' },
        { id: 'student-3' },
        { id: 'student-4' },
      ],
      assignments: submissionCounts.map((submissionCount, index) => ({
        assignmentId: `assignment-${index}`,
        submissions: Array.from({ length: submissionCount }, (_, submissionIndex) => ({
          studentId: `student-${submissionIndex}`,
        })),
      })),
    };
  }

  it('accepts a class whose derived completion matches the supplied bands', () => {
    const classesById = { 'class-0': createCompletionClassView([1, 3, 4, 5]) };

    expect(() => assertCompletionBands(classesById, UNIT_BANDS)).not.toThrow();
  });

  it('rejects an assignment whose derived completion falls outside every band', () => {
    const classesById = { 'class-0': createCompletionClassView([0, 3, 4, 5]) };

    expect(() => assertCompletionBands(classesById, UNIT_BANDS)).toThrow(
      /falls outside every documented completion band/u
    );
  });

  it('rejects a class whose completion distribution does not match the bands', () => {
    const classesById = { 'class-0': createCompletionClassView([1, 1, 1, 1]) };

    expect(() => assertCompletionBands(classesById, UNIT_BANDS)).toThrow(
      /completion distribution/u
    );
  });

  it('rejects a class whose roster is empty', () => {
    const classesById = { 'class-0': { students: [], assignments: [] } };

    expect(() => assertCompletionBands(classesById, UNIT_BANDS)).toThrow(/empty roster/u);
  });
});
