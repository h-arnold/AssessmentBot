import { describe, expect, it } from 'vitest';

import {
  LARGE_FULL_ASSIGNMENTS_PER_CLASS,
  LARGE_FULL_CLASS_COUNT,
  LARGE_FULL_COMPLETION_BANDS as COMPLETION_BANDS,
  LARGE_FULL_STUDENTS_PER_CLASS,
  LARGE_FULL_YEAR_GROUP_COUNT,
  getProfileDefinition,
} from '../../scripts/synthetic-test-data/profileDefinitions.js';
import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import { validateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/validateSyntheticAnalysisGraph.js';
import {
  ClassFullSchema,
  type AssignmentPartial,
  type ClassFull,
} from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod';
import type { YearGroup } from '../../src/frontend/src/services/referenceData/referenceData.zod';

/**
 * Generator-internal observation of a profile definition. No frontend service
 * schema models generator profile parameters, so this stays a narrow test-local
 * view instead of a duplicate production contract.
 */
type GeneratedProfileDefinition = {
  name: string;
  seed: number;
  classCount: number;
  studentsPerClass: number;
  assignmentsPerClass: number;
  yearGroupCount: number;
};

/**
 * Generator-internal observation of the manifest emitted alongside a generated graph.
 */
type GeneratedGraphManifest = {
  schemaVersion: number;
  profile: string;
  seed: number;
  generatedEntityCounts: Record<string, number>;
};

/**
 * Generator-internal observation of a persistence class document. Persistence is
 * not a frontend Zod contract, so only the fields this spec observes are captured.
 */
type GeneratedClassDocument = {
  classId: string;
  yearGroupKey: string | null;
  students: Array<{ id: string }>;
};

/**
 * Generator-internal observation of a persistence assignment record.
 */
type GeneratedAssignmentRecord = {
  courseId: string;
  assignmentId: string;
};

/**
 * Generator-internal observation of the top-level graph. Every named transport
 * view is validated through its real frontend schema; persistence and manifest
 * views remain generator-internal observations because no frontend schema models them.
 */
type GeneratedSyntheticAnalysisGraph = {
  manifest: GeneratedGraphManifest;
  referenceData: {
    cohorts: unknown[];
    yearGroups: YearGroup[];
    assignmentTopics: unknown[];
  };
  persistence: {
    classes: GeneratedClassDocument[];
    assignmentDefinitions: unknown[];
    assignments: GeneratedAssignmentRecord[];
  };
  transport: {
    classPartials: unknown[];
    assignmentDefinitionPartials: unknown[];
    classesById: Record<string, unknown>;
    assignmentsByKey: Record<string, unknown>;
  };
};

const LARGE_FULL_PROFILE = 'large-full';
const FIVE_CLASS_YEAR_GROUP_COUNT = 4;
const YEAR_GROUP_MIN = 7;
const YEAR_GROUP_MAX = 30;
const PERCENT_SCALE = 100;

const largeFullGraph = generateSyntheticAnalysisGraph(
  LARGE_FULL_PROFILE
) as GeneratedSyntheticAnalysisGraph;

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
 * Derives an assignment's completion percentage from its class roster and the
 * generated submissions for that assignment.
 *
 * @param classFull The class transport view carrying the roster and assignments.
 * @param assignment The class assignment whose completion is derived.
 * @returns The rounded completion percentage across the class roster.
 */
function deriveCompletionPercent(classFull: ClassFull, assignment: AssignmentPartial): number {
  const rosterSize = classFull.students.length;
  if (rosterSize === 0) {
    throw new Error(`Expected a non-empty roster for class ${classFull.classId}`);
  }
  return Math.round((assignment.submissions.length / rosterSize) * PERCENT_SCALE);
}

/**
 * Asserts the exact 5/10/70/15 completion-band distribution for every class in a
 * generated large-full graph.
 *
 * @param graph The generated graph whose derived completion distribution is checked.
 * @returns The derived completion count for every assignment, in class-then-assignment order.
 */
function assertCompletionBands(graph: GeneratedSyntheticAnalysisGraph): number[] {
  const classes = parseClassFullViews(graph);
  expect(classes).toHaveLength(LARGE_FULL_CLASS_COUNT);

  const completionCounts: number[] = [];

  for (const classFull of classes) {
    expect(classFull.students).toHaveLength(LARGE_FULL_STUDENTS_PER_CLASS);
    expect(classFull.assignments).toHaveLength(LARGE_FULL_ASSIGNMENTS_PER_CLASS);

    completionCounts.push(
      ...classFull.assignments.map((assignment) => assignment.submissions.length)
    );

    const completionPercents = classFull.assignments.map((assignment) =>
      deriveCompletionPercent(classFull, assignment)
    );

    const bandCounts = COMPLETION_BANDS.map(
      (band) =>
        completionPercents.filter(
          (percent) => percent >= band.minCompletedPercent && percent <= band.maxCompletedPercent
        ).length
    );
    expect(bandCounts).toEqual(COMPLETION_BANDS.map((band) => band.sharePercent));

    for (const percent of completionPercents) {
      const matchingBands = COMPLETION_BANDS.filter(
        (band) => percent >= band.minCompletedPercent && percent <= band.maxCompletedPercent
      );
      expect(matchingBands).toHaveLength(1);
    }
  }

  return completionCounts;
}

describe('large full deterministic graph counts', () => {
  it('produces exactly 100 classes of 30 distinct students and 10,000 assignments', () => {
    expect(largeFullGraph.persistence.classes).toHaveLength(LARGE_FULL_CLASS_COUNT);
    expect(largeFullGraph.persistence.assignments).toHaveLength(
      LARGE_FULL_CLASS_COUNT * LARGE_FULL_ASSIGNMENTS_PER_CLASS
    );

    for (const classDocument of largeFullGraph.persistence.classes) {
      expect(classDocument.students).toHaveLength(LARGE_FULL_STUDENTS_PER_CLASS);
      const studentIds = classDocument.students.map((student) => student.id);
      expect(new Set(studentIds).size).toBe(LARGE_FULL_STUDENTS_PER_CLASS);
    }

    expect(largeFullGraph.manifest.generatedEntityCounts.classes).toBe(LARGE_FULL_CLASS_COUNT);
    expect(largeFullGraph.manifest.generatedEntityCounts.students).toBe(
      LARGE_FULL_CLASS_COUNT * LARGE_FULL_STUDENTS_PER_CLASS
    );
    expect(largeFullGraph.manifest.generatedEntityCounts.assignments).toBe(
      LARGE_FULL_CLASS_COUNT * LARGE_FULL_ASSIGNMENTS_PER_CLASS
    );
  });

  it('distributes the 100 classes four or five per Year Group 7-30', () => {
    const classesByYearGroup = new Map<string, number>();
    for (const classDocument of largeFullGraph.persistence.classes) {
      const yearGroupKey = classDocument.yearGroupKey;
      if (yearGroupKey === null) {
        throw new Error(`Expected a resolved yearGroupKey on class ${classDocument.classId}`);
      }
      classesByYearGroup.set(yearGroupKey, (classesByYearGroup.get(yearGroupKey) ?? 0) + 1);
    }

    expect(classesByYearGroup.size).toBe(LARGE_FULL_YEAR_GROUP_COUNT);
    const distribution = [...classesByYearGroup.values()];
    expect(distribution.every((count) => count === 4 || count === 5)).toBe(true);
    expect(distribution.filter((count) => count === 5)).toHaveLength(FIVE_CLASS_YEAR_GROUP_COUNT);

    const yearGroupLabels = new Set(
      largeFullGraph.referenceData.yearGroups.map((yearGroup) => yearGroup.name)
    );
    for (let year = YEAR_GROUP_MIN; year <= YEAR_GROUP_MAX; year += 1) {
      expect(yearGroupLabels.has(`Year ${year}`)).toBe(true);
    }
  });

  it('applies the 5/10/70/15 completion bands to every class from its roster and submissions', () => {
    const completionCounts = assertCompletionBands(largeFullGraph);

    expect(completionCounts).toHaveLength(
      LARGE_FULL_CLASS_COUNT * LARGE_FULL_ASSIGNMENTS_PER_CLASS
    );
  });

  it('passes full graph invariant validation, including full-definition validity', () => {
    expect(() => validateSyntheticAnalysisGraph(largeFullGraph)).not.toThrow();
  });

  it('changes at least one completion count when the supplied seed changes', () => {
    const full = getProfileDefinition(LARGE_FULL_PROFILE) as GeneratedProfileDefinition;
    const baselineCounts = assertCompletionBands(largeFullGraph);
    const alteredGraph = generateSyntheticAnalysisGraph(LARGE_FULL_PROFILE, {
      seed: full.seed + 1,
    }) as GeneratedSyntheticAnalysisGraph;
    const alteredCounts = assertCompletionBands(alteredGraph);

    expect(alteredCounts).toHaveLength(baselineCounts.length);
    expect(alteredCounts).not.toEqual(baselineCounts);
  });

  it('records the canonical full-profile counts in the manifest', () => {
    const full = getProfileDefinition(LARGE_FULL_PROFILE) as GeneratedProfileDefinition;

    expect(largeFullGraph.manifest.schemaVersion).toBe(1);
    expect(largeFullGraph.manifest.profile).toBe(LARGE_FULL_PROFILE);
    expect(largeFullGraph.manifest.seed).toBe(full.seed);
    expect(largeFullGraph.manifest.generatedEntityCounts.classes).toBe(LARGE_FULL_CLASS_COUNT);
  });
});

/**
 * Reads a class transport view as the schema-validated shape this spec mutates.
 *
 * @param classesById The generated class transport views.
 * @param classId The class identifier to read.
 * @returns The validated class transport view.
 */
function readClassFull(classesById: Record<string, unknown>, classId: string): ClassFull {
  return classesById[classId] as ClassFull;
}

/**
 * Creates a large-full graph copy whose first class roster is reduced to one student.
 *
 * @returns A large-full graph violating the roster-size invariant.
 */
function createReducedRosterGraph(): GeneratedSyntheticAnalysisGraph {
  const firstClass = largeFullGraph.persistence.classes[0];
  const removedStudents = firstClass.students.length - 1;
  const classes = largeFullGraph.persistence.classes.map((classDocument, index) =>
    index === 0 ? { ...classDocument, students: classDocument.students.slice(0, 1) } : classDocument
  );

  return {
    ...largeFullGraph,
    manifest: {
      ...largeFullGraph.manifest,
      generatedEntityCounts: {
        ...largeFullGraph.manifest.generatedEntityCounts,
        students: largeFullGraph.manifest.generatedEntityCounts.students - removedStudents,
      },
    },
    persistence: { ...largeFullGraph.persistence, classes },
  };
}

/**
 * Creates a large-full graph copy whose first class transport view exposes a single
 * assignment.
 *
 * @returns A large-full graph violating the assignment-count invariant.
 */
function createReducedAssignmentsGraph(): GeneratedSyntheticAnalysisGraph {
  const classesById = { ...largeFullGraph.transport.classesById };
  const firstClassId = Object.keys(classesById)[0];
  if (firstClassId === undefined) {
    throw new Error('Expected at least one generated class');
  }
  const firstClass = readClassFull(classesById, firstClassId);
  classesById[firstClassId] = {
    ...firstClass,
    assignments: firstClass.assignments.slice(0, 1),
  };

  return {
    ...largeFullGraph,
    transport: { ...largeFullGraph.transport, classesById },
  };
}

/**
 * Creates a large-full graph copy whose first class has no submissions on any
 * assignment, so its derived completion leaves every documented band.
 *
 * @returns A large-full graph violating the completion-band invariant.
 */
function createEmptyCompletionGraph(): GeneratedSyntheticAnalysisGraph {
  const classesById = { ...largeFullGraph.transport.classesById };
  const firstClassId = Object.keys(classesById)[0];
  if (firstClassId === undefined) {
    throw new Error('Expected at least one generated class');
  }
  const firstClass = readClassFull(classesById, firstClassId);
  classesById[firstClassId] = {
    ...firstClass,
    assignments: firstClass.assignments.map((assignment) => ({
      ...assignment,
      submissions: [],
    })),
  };

  return {
    ...largeFullGraph,
    transport: { ...largeFullGraph.transport, classesById },
  };
}

/**
 * Creates a large-full graph copy that moves one class into the first class's
 * Year Group, making the four-or-five class distribution uneven.
 *
 * @returns A large-full graph violating the Year Group distribution invariant.
 */
function createUnevenYearGroupGraph(): GeneratedSyntheticAnalysisGraph {
  const firstYearGroupKey = largeFullGraph.persistence.classes[0].yearGroupKey;
  if (firstYearGroupKey === null) {
    throw new Error('Expected a resolved yearGroupKey on the first class');
  }
  const classes = largeFullGraph.persistence.classes.map((classDocument, index) =>
    index === 1 ? { ...classDocument, yearGroupKey: firstYearGroupKey } : classDocument
  );

  return {
    ...largeFullGraph,
    persistence: { ...largeFullGraph.persistence, classes },
  };
}

describe('large full negative invariant validation', () => {
  it('rejects a class whose roster size is reduced below the profile requirement', () => {
    expect(() => validateSyntheticAnalysisGraph(createReducedRosterGraph())).toThrow(/students/u);
  });

  it('rejects a class whose assignment count is reduced below the profile requirement', () => {
    expect(() => validateSyntheticAnalysisGraph(createReducedAssignmentsGraph())).toThrow(
      /assignments/u
    );
  });

  it('rejects an uneven Year Group distribution', () => {
    expect(() => validateSyntheticAnalysisGraph(createUnevenYearGroupGraph())).toThrow(
      /Year Group/u
    );
  });

  it('rejects a class whose derived completion falls outside the documented bands', () => {
    expect(() => validateSyntheticAnalysisGraph(createEmptyCompletionGraph())).toThrow(
      /completion band/u
    );
  });
});
