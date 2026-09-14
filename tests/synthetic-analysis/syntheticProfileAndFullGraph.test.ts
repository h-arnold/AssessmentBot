import { describe, expect, it } from 'vitest';

import {
  PROFILE_NAMES,
  getProfileDefinition,
} from '../../scripts/synthetic-test-data/profileDefinitions.js';
import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import {
  ClassFullSchema,
  type ClassFull,
} from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod';
import { ClassPartialsResponseSchema } from '../../src/frontend/src/services/googleClassrooms/classPartials.zod';
import { AssignmentDefinitionPartialsResponseSchema } from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { AssignmentFullSchema } from '../../src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod';
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
  canonicalFullProfile?: {
    classCount: number;
    studentsPerClass: number;
    assignmentsPerClass: number;
    yearGroupCount: number;
  };
};

/**
 * Generator-internal observation of a persistence class roster.
 */
type GeneratedClassDocument = {
  students: Array<{ id: string }>;
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
    assignments: unknown[];
  };
  transport: {
    classPartials: unknown[];
    assignmentDefinitionPartials: unknown[];
    classesById: Record<string, unknown>;
    assignmentsByKey: Record<string, unknown>;
  };
};

const SMALL_PROFILE = 'small';
const MEDIUM_PROFILE = 'medium';
const LARGE_REPRESENTATIVE_PROFILE = 'large-representative';
const LARGE_FULL_PROFILE = 'large-full';

const EXPECTED_PROFILE_NAMES = [
  SMALL_PROFILE,
  MEDIUM_PROFILE,
  LARGE_REPRESENTATIVE_PROFILE,
  LARGE_FULL_PROFILE,
];

const FULL_LARGE_CLASS_COUNT = 100;
const FULL_LARGE_STUDENTS_PER_CLASS = 30;
const FULL_LARGE_ASSIGNMENTS_PER_CLASS = 100;
const FULL_LARGE_YEAR_GROUP_COUNT = 24;

const representativeGraph = generateSyntheticAnalysisGraph(
  LARGE_REPRESENTATIVE_PROFILE
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
 * Derives the entity counts the manifest must declare from the generated graph.
 *
 * @param graph The generated graph whose actual counts are derived.
 * @returns Actual counts keyed by manifest entity name.
 */
function actualEntityCounts(graph: GeneratedSyntheticAnalysisGraph): Record<string, number> {
  return {
    classes: graph.persistence.classes.length,
    students: graph.persistence.classes.reduce(
      (total, classDocument) => total + classDocument.students.length,
      0
    ),
    assignments: graph.persistence.assignments.length,
    assignmentDefinitions: graph.persistence.assignmentDefinitions.length,
    cohorts: graph.referenceData.cohorts.length,
    yearGroups: graph.referenceData.yearGroups.length,
    assignmentTopics: graph.referenceData.assignmentTopics.length,
  };
}

describe('synthetic analysis profile definitions', () => {
  it('exposes the four supported deterministic profiles', () => {
    const names = PROFILE_NAMES as string[];

    expect(names).toHaveLength(EXPECTED_PROFILE_NAMES.length);
    expect(names).toEqual(expect.arrayContaining(EXPECTED_PROFILE_NAMES));
  });

  it('pins deterministic seeds per profile without wall-clock dependence', () => {
    const seeds = (PROFILE_NAMES as string[]).map(
      (name) => (getProfileDefinition(name) as GeneratedProfileDefinition).seed
    );

    for (const seed of seeds) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
    }

    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('models the canonical large profile as 100 classes of 30 students with 100 assignments', () => {
    const full = getProfileDefinition(LARGE_FULL_PROFILE) as GeneratedProfileDefinition;

    expect(full.classCount).toBe(FULL_LARGE_CLASS_COUNT);
    expect(full.studentsPerClass).toBe(FULL_LARGE_STUDENTS_PER_CLASS);
    expect(full.assignmentsPerClass).toBe(FULL_LARGE_ASSIGNMENTS_PER_CLASS);
    expect(full.yearGroupCount).toBe(FULL_LARGE_YEAR_GROUP_COUNT);
  });

  it('rejects an unsupported profile name with an actionable error', () => {
    expect(() => getProfileDefinition('not-a-real-profile')).toThrow(/not-a-real-profile/u);
  });
});

describe('representative projection manifest', () => {
  it('declares its own smaller counts and the canonical full-profile parameters', () => {
    const declaredCounts = representativeGraph.manifest.generatedEntityCounts;
    const actualCounts = actualEntityCounts(representativeGraph);

    expect(declaredCounts).toEqual(
      expect.objectContaining({
        classes: expect.any(Number),
        students: expect.any(Number),
        assignments: expect.any(Number),
        yearGroups: expect.any(Number),
      })
    );

    expect(Object.keys(declaredCounts).length).toBeGreaterThan(0);
    for (const [entityName, declaredCount] of Object.entries(declaredCounts)) {
      expect(
        actualCounts[entityName],
        `manifest count '${entityName}' must map to a graph count`
      ).toBeDefined();
      expect(declaredCount).toBe(actualCounts[entityName]);
    }

    expect(representativeGraph.manifest.profile).toBe(LARGE_REPRESENTATIVE_PROFILE);
    expect(declaredCounts.classes).toBeLessThan(FULL_LARGE_CLASS_COUNT);
    expect(declaredCounts.assignments).toBeLessThan(
      FULL_LARGE_CLASS_COUNT * FULL_LARGE_ASSIGNMENTS_PER_CLASS
    );

    expect(representativeGraph.manifest.canonicalFullProfile).toMatchObject({
      classCount: FULL_LARGE_CLASS_COUNT,
      studentsPerClass: FULL_LARGE_STUDENTS_PER_CLASS,
      assignmentsPerClass: FULL_LARGE_ASSIGNMENTS_PER_CLASS,
      yearGroupCount: FULL_LARGE_YEAR_GROUP_COUNT,
    });
  });
});

describe('representative projection transport contracts', () => {
  it('parses every named transport view through its canonical frontend schema', () => {
    const classFulls = parseClassFullViews(representativeGraph);
    const classPartials = ClassPartialsResponseSchema.parse(
      representativeGraph.transport.classPartials
    );
    const definitionPartials = AssignmentDefinitionPartialsResponseSchema.parse(
      representativeGraph.transport.assignmentDefinitionPartials
    );
    const assignments = Object.values(representativeGraph.transport.assignmentsByKey).map(
      (assignment) => AssignmentFullSchema.parse(assignment)
    );

    expect(classFulls.length).toBeGreaterThan(0);
    expect(classPartials.length).toBeGreaterThan(0);
    expect(definitionPartials.length).toBeGreaterThan(0);
    expect(assignments.length).toBeGreaterThan(0);
  });
});
