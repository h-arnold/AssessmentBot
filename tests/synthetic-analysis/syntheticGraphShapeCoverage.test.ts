import { describe, expect, it, vi } from 'vitest';

import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import {
  ClassFullSchema,
  type ClassFull,
} from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod';
import {
  AssignmentDefinitionPartialsResponseSchema,
  type AssignmentDefinitionPartial,
} from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { AssignmentFull } from '../../src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod';

/**
 * Generator-internal observation of a persisted submission artefact. Persistence
 * is not a frontend Zod contract, so only the fields this spec compares are captured.
 */
type GeneratedPersistenceArtifact = {
  uid: string;
  pageId: string | null;
  documentId: string | null;
};

/**
 * Generator-internal observation of a persisted submission item.
 */
type GeneratedPersistenceItem = {
  id: string;
  taskId: string;
  artifact: GeneratedPersistenceArtifact;
};

/**
 * Generator-internal observation of a persisted submission.
 */
type GeneratedPersistenceSubmission = {
  studentId: string;
  items: Record<string, GeneratedPersistenceItem>;
};

/**
 * Generator-internal observation of a persisted assignment record.
 */
type GeneratedPersistenceAssignment = {
  assignmentId: string;
  assignmentDefinitionKey: string;
  submissions: GeneratedPersistenceSubmission[];
};

/**
 * Generator-internal observation of a persisted assignment definition.
 */
type GeneratedDefinitionDocument = {
  definitionKey: string;
  referenceDocumentId: string | null;
  templateDocumentId: string | null;
  assignmentWeighting: number | null;
  tasks: Record<string, unknown> | unknown[];
};

/**
 * Generator-internal observation of the top-level graph. Transport views are
 * typed against the real frontend service contracts; no production shape is
 * redeclared here.
 */
type GeneratedSyntheticAnalysisGraph = {
  persistence: {
    assignmentDefinitions: GeneratedDefinitionDocument[];
    assignments: GeneratedPersistenceAssignment[];
  };
  transport: {
    assignmentDefinitionPartials: AssignmentDefinitionPartial[];
    classesById: Record<string, ClassFull>;
    assignmentsByKey: Record<string, AssignmentFull>;
  };
};

/**
 * A generated record that carries a `createdAt`/`updatedAt` pair. Both fields
 * are nullable in the definition contract, hence the nullable types.
 */
type GeneratedTimestampPair = {
  label: string;
  createdAt: string | null | undefined;
  updatedAt: string | null | undefined;
};

const SMALL_PROFILE = 'small';
const MEDIUM_PROFILE = 'medium';

const UTC_ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const EARLIEST_BOUNDED_ACADEMIC_INSTANT_MS = Date.UTC(2000, 0, 1);
const LATEST_BOUNDED_ACADEMIC_INSTANT_MS = Date.UTC(2100, 0, 1);
const MAX_BOUNDED_ACADEMIC_TIMELINE_SPAN_MS = Date.UTC(2030, 0, 1) - Date.UTC(2020, 0, 1);

const smallGraph = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;
const mediumGraph = generateSyntheticAnalysisGraph(
  MEDIUM_PROFILE
) as GeneratedSyntheticAnalysisGraph;
const compactGraphs = [smallGraph, mediumGraph];

/**
 * Parses every raw `getABClass` transport view through the real frontend schema.
 *
 * @param graph The generated graph carrying the raw class transport views.
 * @returns The schema-validated `ClassFull` views.
 */
function parseClassFullViews(graph: GeneratedSyntheticAnalysisGraph): ClassFull[] {
  return Object.values(graph.transport.classesById).map((classFull) =>
    ClassFullSchema.parse(classFull)
  );
}

/**
 * Parses a generated UTC ISO 8601 timestamp.
 *
 * @param value The generated timestamp string.
 * @returns The parsed epoch milliseconds.
 */
function parseGeneratedUtcInstant(value: string): number {
  if (!UTC_ISO_INSTANT_PATTERN.test(value)) {
    throw new Error(`Expected a bounded UTC ISO 8601 timestamp but received "${value}"`);
  }
  const instant = Date.parse(value);
  if (Number.isNaN(instant)) {
    throw new Error(`Expected "${value}" to parse as a valid UTC instant`);
  }
  return instant;
}

/**
 * Collects every generated record that carries a `createdAt`/`updatedAt` pair
 * from the class and full-assignment transport views.
 *
 * @param graph The generated graph to inspect.
 * @returns The timestamp pairs with human-readable labels.
 */
function collectTimestampPairs(graph: GeneratedSyntheticAnalysisGraph): GeneratedTimestampPair[] {
  const pairs: GeneratedTimestampPair[] = [];

  for (const definition of graph.transport.assignmentDefinitionPartials) {
    pairs.push({
      label: `definition ${definition.definitionKey}`,
      createdAt: definition.createdAt,
      updatedAt: definition.updatedAt,
    });
  }

  for (const classFull of parseClassFullViews(graph)) {
    for (const assignment of classFull.assignments) {
      pairs.push({
        label: `class assignment ${assignment.assignmentId}`,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
      });
      for (const submission of assignment.submissions) {
        pairs.push({
          label: `submission ${assignment.assignmentId}/${submission.studentId}`,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt,
        });
      }
    }
  }

  for (const assignment of Object.values(graph.transport.assignmentsByKey)) {
    pairs.push({
      label: `assignment ${assignment.assignmentId}`,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    });
    for (const submission of assignment.submissions) {
      pairs.push({
        label: `full submission ${assignment.assignmentId}/${submission.studentId}`,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
      });
    }
  }

  return pairs;
}

describe('synthetic transport partial/full identity retention', () => {
  it('retains assignment, definition, submission, item, and artefact identifiers across views', () => {
    for (const graph of compactGraphs) {
      const fullAssignmentsById = new Map(
        Object.values(graph.transport.assignmentsByKey).map((assignment) => [
          assignment.assignmentId,
          assignment,
        ])
      );

      const partialAssignmentIds = new Set<string>();

      for (const classFull of parseClassFullViews(graph)) {
        for (const partialAssignment of classFull.assignments) {
          partialAssignmentIds.add(partialAssignment.assignmentId);

          const fullAssignment = fullAssignmentsById.get(partialAssignment.assignmentId);
          // Partial-only assignments reference a partial-only definition and have
          // no full counterpart; they are asserted separately below.
          if (fullAssignment === undefined) {
            continue;
          }

          expect(fullAssignment.assignmentDefinition.definitionKey).toBe(
            partialAssignment.assignmentDefinitionKey
          );

          const fullSubmissions = new Map(
            fullAssignment.submissions.map((submission) => [submission.studentId, submission])
          );
          const partialSubmissions = new Map(
            partialAssignment.submissions.map((submission) => [submission.studentId, submission])
          );
          expect([...partialSubmissions.keys()].sort()).toEqual([...fullSubmissions.keys()].sort());

          for (const [studentId, partialSubmission] of partialSubmissions) {
            const fullSubmission = fullSubmissions.get(studentId);
            expect(fullSubmission).toBeDefined();
            if (fullSubmission === undefined) {
              continue;
            }

            expect(partialSubmission.assignmentId).toBe(partialAssignment.assignmentId);
            expect(fullSubmission.assignmentId).toBe(fullAssignment.assignmentId);
            expect(Object.keys(partialSubmission.items).sort()).toEqual(
              Object.keys(fullSubmission.items).sort()
            );

            for (const [taskId, partialItem] of Object.entries(partialSubmission.items)) {
              const fullItem = fullSubmission.items[taskId];
              expect(fullItem).toBeDefined();
              if (fullItem === undefined) {
                continue;
              }

              expect(partialItem.taskId).toBe(taskId);
              expect(fullItem.taskId).toBe(taskId);
              expect(fullItem.id).toBe(partialItem.id);
              expect(fullItem.artifact.uid).toBe(partialItem.artifact.uid);
            }
          }
        }
      }

      // Every full assignment has a class partial counterpart; the class view also
      // carries the bounded partial-only assignments.
      for (const fullAssignmentId of fullAssignmentsById.keys()) {
        expect(partialAssignmentIds.has(fullAssignmentId)).toBe(true);
      }
      expect(partialAssignmentIds.size).toBeGreaterThan(fullAssignmentsById.size);
    }
  });
});

describe('synthetic full projection preserves persisted values exactly', () => {
  it('retains persisted definition document IDs, weighting, and artefact identifiers', () => {
    for (const graph of compactGraphs) {
      const definitionsByKey = new Map(
        graph.persistence.assignmentDefinitions.map((definition) => [
          definition.definitionKey,
          definition,
        ])
      );
      const assignmentsById = new Map(
        graph.persistence.assignments.map((assignment) => [assignment.assignmentId, assignment])
      );
      const fullAssignments = Object.values(graph.transport.assignmentsByKey);

      expect(fullAssignments.length).toBeGreaterThan(0);

      for (const fullAssignment of fullAssignments) {
        const persistedAssignment = assignmentsById.get(fullAssignment.assignmentId);
        const persistedDefinition = definitionsByKey.get(
          fullAssignment.assignmentDefinition.definitionKey
        );
        expect(persistedAssignment).toBeDefined();
        expect(persistedDefinition).toBeDefined();
        if (persistedAssignment === undefined || persistedDefinition === undefined) {
          continue;
        }

        // Only valid full-model definitions may back a full assignment.
        expect(persistedDefinition.referenceDocumentId).toEqual(expect.any(String));
        expect(persistedDefinition.templateDocumentId).toEqual(expect.any(String));
        expect(typeof persistedDefinition.assignmentWeighting).toBe('number');

        expect(fullAssignment.referenceDocumentId).toBe(persistedDefinition.referenceDocumentId);
        expect(fullAssignment.templateDocumentId).toBe(persistedDefinition.templateDocumentId);
        expect(fullAssignment.assignmentDefinition.referenceDocumentId).toBe(
          persistedDefinition.referenceDocumentId
        );
        expect(fullAssignment.assignmentDefinition.templateDocumentId).toBe(
          persistedDefinition.templateDocumentId
        );
        expect(fullAssignment.assignmentDefinition.assignmentWeighting).toBe(
          persistedDefinition.assignmentWeighting
        );

        const persistedSubmissions = new Map(
          persistedAssignment.submissions.map((submission) => [submission.studentId, submission])
        );
        for (const fullSubmission of fullAssignment.submissions) {
          const persistedSubmission = persistedSubmissions.get(fullSubmission.studentId);
          expect(persistedSubmission).toBeDefined();
          if (persistedSubmission === undefined) {
            continue;
          }

          for (const [taskId, fullItem] of Object.entries(fullSubmission.items)) {
            const persistedItem = persistedSubmission.items[taskId];
            expect(persistedItem).toBeDefined();
            if (persistedItem === undefined) {
              continue;
            }

            expect(fullItem.id).toBe(persistedItem.id);
            expect(fullItem.artifact.uid).toBe(persistedItem.artifact.uid);
            expect(fullItem.artifact.pageId).toBe(persistedItem.artifact.pageId);
            expect(fullItem.artifact.documentId).toBe(persistedItem.artifact.documentId);
          }
        }
      }
    }
  });
});

describe('synthetic analysis nullable contract coverage', () => {
  it('exercises nullable class fields in the compact profiles', () => {
    for (const graph of compactGraphs) {
      const classes = parseClassFullViews(graph);
      expect(classes.some((classFull) => classFull.className === null)).toBe(true);
      expect(classes.some((classFull) => classFull.cohortKey === null)).toBe(true);
      expect(classes.some((classFull) => classFull.classOwner === null)).toBe(true);
      expect(classes.some((classFull) => classFull.active === null)).toBe(true);
    }
  });

  it('exercises nullable assignment fields in the compact profiles', () => {
    for (const graph of compactGraphs) {
      const assignments = parseClassFullViews(graph).flatMap((classFull) => classFull.assignments);
      expect(assignments.some((assignment) => assignment.dueDate === null)).toBe(true);
      expect(assignments.some((assignment) => assignment.updatedAt === null)).toBe(true);
      expect(assignments.some((assignment) => assignment.documentType === null)).toBe(true);
    }
  });

  it('exercises nullable assignment-definition fields in the compact profiles', () => {
    for (const graph of compactGraphs) {
      const definitions = AssignmentDefinitionPartialsResponseSchema.parse(
        graph.transport.assignmentDefinitionPartials
      );
      expect(definitions.some((definition) => definition.referenceDocumentId === null)).toBe(true);
      expect(definitions.some((definition) => definition.templateDocumentId === null)).toBe(true);
      expect(definitions.some((definition) => definition.assignmentWeighting === null)).toBe(true);
    }
  });

  it('exercises nullable submission fields in the compact profiles', () => {
    for (const graph of compactGraphs) {
      const submissions = parseClassFullViews(graph).flatMap((classFull) =>
        classFull.assignments.flatMap((assignment) => assignment.submissions)
      );
      expect(submissions.some((submission) => submission.documentId === null)).toBe(true);
      expect(submissions.some((submission) => submission.studentName === null)).toBe(true);
    }
  });

  it('exercises nullable task-artefact fields in the compact profiles', () => {
    for (const graph of compactGraphs) {
      const items = parseClassFullViews(graph).flatMap((classFull) =>
        classFull.assignments.flatMap((assignment) =>
          assignment.submissions.flatMap((submission) => Object.values(submission.items))
        )
      );
      expect(items.length).toBeGreaterThan(0);
      expect(
        items.some((item) => item.artifact.pageId === null || item.artifact.pageId === undefined)
      ).toBe(true);
      expect(
        items.some(
          (item) => item.artifact.documentId === null || item.artifact.documentId === undefined
        )
      ).toBe(true);
    }
  });
});

describe('synthetic transport timestamp contract', () => {
  it('emits bounded UTC ISO timestamps for every timestamped record', () => {
    const pairs = collectTimestampPairs(smallGraph);
    expect(pairs.length).toBeGreaterThan(0);

    const instants: number[] = [];
    for (const { createdAt, updatedAt } of pairs) {
      for (const value of [createdAt, updatedAt]) {
        if (value === null || value === undefined) {
          continue;
        }
        const instant = parseGeneratedUtcInstant(value);
        expect(instant).toBeGreaterThanOrEqual(EARLIEST_BOUNDED_ACADEMIC_INSTANT_MS);
        expect(instant).toBeLessThanOrEqual(LATEST_BOUNDED_ACADEMIC_INSTANT_MS);
        instants.push(instant);
      }
    }

    expect(instants.length).toBeGreaterThan(0);
    const span = Math.max(...instants) - Math.min(...instants);
    expect(span).toBeLessThanOrEqual(MAX_BOUNDED_ACADEMIC_TIMELINE_SPAN_MS);
  });

  it('enforces the bounded UTC timestamp representation used by the assertions', () => {
    expect(() => parseGeneratedUtcInstant('2024-01-01 12:00:00')).toThrow(/bounded UTC/u);
    expect(() => parseGeneratedUtcInstant('2024-01-01T12:00:00+01:00')).toThrow(/bounded UTC/u);
    expect(parseGeneratedUtcInstant('2024-01-01T12:00:00.000Z')).toBe(
      Date.UTC(2024, 0, 1, 12, 0, 0)
    );
  });

  it('preserves createdAt-to-updatedAt ordering on every timestamped record', () => {
    for (const { label, createdAt, updatedAt } of collectTimestampPairs(smallGraph)) {
      if (createdAt === null || createdAt === undefined) {
        continue;
      }
      if (updatedAt === null || updatedAt === undefined) {
        continue;
      }
      expect(
        parseGeneratedUtcInstant(updatedAt) >= parseGeneratedUtcInstant(createdAt),
        `${label} must not be updated before it was created`
      ).toBe(true);
    }
  });

  it('does not derive generated timestamps from the system clock', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2001-02-03T04:05:06.000Z'));
      const early = JSON.stringify(generateSyntheticAnalysisGraph(SMALL_PROFILE));
      vi.setSystemTime(new Date('2099-12-31T23:59:59.000Z'));
      const late = JSON.stringify(generateSyntheticAnalysisGraph(SMALL_PROFILE));
      expect(late).toBe(early);
    } finally {
      vi.useRealTimers();
    }
  });
});
