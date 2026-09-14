import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import { validateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/validateSyntheticAnalysisGraph.js';
import type {
  AssignmentPartial,
  ClassFull,
} from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartial } from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassPartial } from '../../src/frontend/src/services/googleClassrooms/classPartials.zod';

/**
 * Generator-internal observation of a persistence assignment definition.
 */
type GeneratedAssignmentDefinition = {
  definitionKey: string;
  tasks: Record<string, unknown> | Array<{ taskId: string }>;
};

/**
 * Generator-internal observation of a persistence assignment record and its
 * roster-bound submissions. Persistence is not a frontend Zod contract, so this
 * spec names the fields it mutates.
 */
type GeneratedAssignmentRecord = {
  courseId: string;
  assignmentId: string;
  assignmentName: string;
  assignmentDefinitionKey: string;
  dueDate: string | null;
  updatedAt: string | null;
  createdAt: string;
  documentType: string | null;
  submissions: Array<{ studentId: string; assignmentId: string }>;
};

/**
 * Backend `Assignment.toPartialJSON()` writes a raw `courseId` and
 * `assignmentName` into the class transport view, but the frontend
 * `AssignmentPartialSchema` strips them. This narrow observation names the raw
 * `courseId` field so the parsed persistence identities stay typed.
 */
type GeneratedClassAssignmentIdentity = {
  courseId: string;
  assignmentId: string;
  assignmentDefinitionKey: string;
};

/**
 * Generator-internal observation of a full assignment transport entry. Only the
 * fields this spec mutates are captured.
 */
type GeneratedFullAssignment = {
  assignmentId: string;
  courseId: string;
  submissions: Array<{
    studentId: string;
    assignmentId: string;
    items: Record<string, { taskId: string }>;
  }>;
};

/**
 * Mutable observation of the generated graph used to build corrupted fixtures.
 */
type MutableGraph = {
  manifest: { generatedEntityCounts: Record<string, number> };
  transport: {
    classPartials: ClassPartial[];
    assignmentDefinitionPartials: AssignmentDefinitionPartial[];
    classesById: Record<string, ClassFull>;
    assignmentsByKey: Record<string, unknown>;
  };
  referenceData: unknown;
  persistence: {
    classes: Array<{ classId: string; students: Array<{ id: string }> }>;
    assignmentDefinitions: GeneratedAssignmentDefinition[];
    assignments: GeneratedAssignmentRecord[];
  };
};

const SMALL_PROFILE = 'small';

/**
 * Creates a fresh, locally mutable copy of the generated small-profile graph.
 *
 * @returns A mutable copy of the small-profile logical graph.
 */
function createMutableGraph(): MutableGraph {
  return structuredClone(generateSyntheticAnalysisGraph(SMALL_PROFILE)) as MutableGraph;
}

/**
 * Returns the first class identifier present in the class transport view.
 *
 * @param graph The mutable graph under test.
 * @returns The first class identifier.
 */
function firstClassId(graph: MutableGraph): string {
  const classId = Object.keys(graph.transport.classesById)[0];
  if (classId === undefined) {
    throw new Error('Expected at least one generated class');
  }
  return classId;
}

/**
 * Returns the first class-embedded assignment that carries a submission.
 *
 * @param graph The mutable graph under test.
 * @returns The first class assignment with a submission.
 */
function firstClassAssignmentWithSubmission(graph: MutableGraph): AssignmentPartial {
  const classFull = graph.transport.classesById[firstClassId(graph)];
  const assignment = classFull.assignments.find((candidate) => candidate.submissions.length > 0);
  if (assignment === undefined) {
    throw new Error('Expected at least one generated class submission');
  }
  return assignment;
}

/**
 * Returns the first full assignment that carries a submission.
 *
 * @param graph The mutable graph under test.
 * @returns The first full assignment with a submission.
 */
function firstFullAssignmentWithSubmission(graph: MutableGraph): GeneratedFullAssignment {
  for (const assignment of Object.values(graph.transport.assignmentsByKey)) {
    const candidate = assignment as GeneratedFullAssignment;
    if (candidate.submissions.length > 0) {
      return candidate;
    }
  }
  throw new Error('Expected at least one generated full assignment submission');
}

/**
 * Returns the first full transport assignment together with the persistence
 * assignment that owns it.
 *
 * @param graph The mutable graph under test.
 * @returns The full assignment entry and its persistence owner.
 */
function firstFullAssignmentWithPersistenceOwner(graph: MutableGraph): {
  assignment: GeneratedFullAssignment;
  owner: GeneratedAssignmentRecord;
} {
  for (const [assignmentId, entry] of Object.entries(graph.transport.assignmentsByKey)) {
    const owner = graph.persistence.assignments.find(
      (candidate) => candidate.assignmentId === assignmentId
    );
    if (owner !== undefined) {
      return { assignment: entry as GeneratedFullAssignment, owner };
    }
  }
  throw new Error('Expected a generated full assignment with a persistence owner');
}

describe('synthetic assignment course ownership and parentage validation', () => {
  it('rejects a persistence assignment whose courseId does not resolve to a generated class', () => {
    const graph = createMutableGraph();
    const partialDefinition = graph.persistence.assignmentDefinitions.find((definition) =>
      Array.isArray(definition.tasks)
    );
    if (partialDefinition === undefined) {
      throw new Error('Expected a generated partial-only definition');
    }

    graph.persistence.assignments.push({
      courseId: 'class-not-generated',
      assignmentId: 'assignment-not-generated',
      assignmentName: 'Synthetic Phantom Assignment',
      assignmentDefinitionKey: partialDefinition.definitionKey,
      dueDate: null,
      updatedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      documentType: null,
      submissions: [],
    });
    graph.manifest.generatedEntityCounts.assignments += 1;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(
      /does not resolve to a generated class/u
    );
  });

  it('rejects a persistence submission whose assignmentId does not name its owning assignment', () => {
    const graph = createMutableGraph();
    const assignment = graph.persistence.assignments.find(
      (candidate) => candidate.submissions.length > 0
    );
    if (assignment === undefined) {
      throw new Error('Expected a persistence assignment with submissions');
    }
    assignment.submissions[0].assignmentId = 'assignment-not-generated';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(
      /instead of its owning assignment/u
    );
  });

  it('rejects a class transport assignment swapped into a different class', () => {
    const graph = createMutableGraph();
    const [firstClassIdValue, secondClassIdValue] = Object.keys(graph.transport.classesById);
    const firstClass = graph.transport.classesById[firstClassIdValue];
    const secondClass = graph.transport.classesById[secondClassIdValue];
    const movedAssignment = firstClass.assignments[0];
    firstClass.assignments[0] = secondClass.assignments[0];
    secondClass.assignments[0] = movedAssignment;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/owning class/u);
  });

  it('rejects a class transport assignment whose courseId names a different valid class', () => {
    const graph = createMutableGraph();
    const classId = firstClassId(graph);
    const otherClassId = Object.keys(graph.transport.classesById).find(
      (candidate) => candidate !== classId
    );
    if (otherClassId === undefined) {
      throw new Error('Expected more than one generated class');
    }
    const assignment = firstClassAssignmentWithSubmission(
      graph
    ) as unknown as GeneratedClassAssignmentIdentity;
    const owner = graph.persistence.assignments.find(
      (candidate) => candidate.assignmentId === assignment.assignmentId
    );
    if (owner === undefined) {
      throw new Error('Expected a persistence owner for the class assignment');
    }

    assignment.courseId = otherClassId;

    expect(assignment.assignmentId).toBe(owner.assignmentId);
    expect(assignment.assignmentDefinitionKey).toBe(owner.assignmentDefinitionKey);
    expect(owner.courseId).toBe(classId);

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(
      /carries courseId .* instead of its owning class/u
    );
  });

  it('rejects a class transport entry whose classId does not match its classesById key', () => {
    const graph = createMutableGraph();
    const [classId, otherClassId] = Object.keys(graph.transport.classesById);
    if (classId === undefined || otherClassId === undefined) {
      throw new Error('Expected at least two generated classes');
    }
    graph.transport.classesById[classId].classId = otherClassId;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(
      /does not match classFull\.classId/u
    );
  });

  it('rejects a class transport submission whose assignmentId does not name its owning assignment', () => {
    const graph = createMutableGraph();
    const assignment = firstClassAssignmentWithSubmission(graph);
    assignment.submissions[0].assignmentId = 'assignment-not-generated';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(
      /instead of its owning assignment/u
    );
  });

  it('rejects a class transport assignment whose fictitious assignmentId does not resolve to a persistence assignment', () => {
    const graph = createMutableGraph();
    const assignment = firstClassAssignmentWithSubmission(graph);
    assignment.assignmentId = 'assignment-not-generated';
    for (const submission of assignment.submissions) {
      submission.assignmentId = 'assignment-not-generated';
    }

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(
      /does not resolve to a persistence assignment/u
    );
  });

  it('rejects a full transport submission whose assignmentId does not name its owning assignment', () => {
    const graph = createMutableGraph();
    const assignment = firstFullAssignmentWithSubmission(graph);
    assignment.submissions[0].assignmentId = 'assignment-not-generated';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(
      /instead of its owning assignment/u
    );
  });

  it('rejects a full transport assignment whose courseId does not name its persistence owning class', () => {
    const graph = createMutableGraph();
    const { assignment, owner } = firstFullAssignmentWithPersistenceOwner(graph);
    const otherClassId = Object.keys(graph.transport.classesById).find(
      (classId) => classId !== owner.courseId
    );
    if (otherClassId === undefined) {
      throw new Error('Expected more than one generated class');
    }
    assignment.courseId = otherClassId;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(
      /does not match its persistence owning class/u
    );
  });

  it('rejects a full transport submission whose studentId is outside its persistence owning class roster', () => {
    const graph = createMutableGraph();
    const assignment = firstFullAssignmentWithSubmission(graph);
    assignment.submissions[0].studentId = 'student-not-on-roster';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/outside class/u);
  });

  it('rejects a full transport submission item whose taskId is not declared by its persistence definition', () => {
    const graph = createMutableGraph();
    const assignment = firstFullAssignmentWithSubmission(graph);
    const item = Object.values(assignment.submissions[0].items)[0];
    if (item === undefined) {
      throw new Error('Expected a generated full assignment submission item');
    }
    item.taskId = 'task-not-declared';

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/task-not-declared/u);
  });

  it('rejects a class transport assignment whose assignmentDefinitionKey does not equal its persistence owner definition key', () => {
    const graph = createMutableGraph();
    const assignment = firstClassAssignmentWithSubmission(graph);
    const owner = graph.persistence.assignments.find(
      (candidate) => candidate.assignmentId === assignment.assignmentId
    );
    if (owner === undefined) {
      throw new Error('Expected a persistence owner for the class assignment');
    }
    const differentDefinition = graph.persistence.assignmentDefinitions.find(
      (definition) => definition.definitionKey !== owner.assignmentDefinitionKey
    );
    if (differentDefinition === undefined) {
      throw new Error('Expected a second generated definition to swap in');
    }
    assignment.assignmentDefinitionKey = differentDefinition.definitionKey;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(
      /instead of its persistence owner's/u
    );
  });

  it('accepts the generated graph after the ownership and parentage checks', () => {
    const graph = createMutableGraph();

    expect(() => validateSyntheticAnalysisGraph(graph)).not.toThrow();
  });
});
