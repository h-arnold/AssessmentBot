import { describe, expect, it } from 'vitest';

import { getProfileDefinition } from '../../scripts/synthetic-test-data/profileDefinitions.js';
import { generateReferenceData } from '../../scripts/synthetic-test-data/generateReferenceData.js';
import { generateAssignmentDefinitions } from '../../scripts/synthetic-test-data/generateAssignmentDefinitions.js';
import { generateAssignments } from '../../scripts/synthetic-test-data/generateAssignments.js';
import { generateSubmissions } from '../../scripts/synthetic-test-data/generateSubmissions.js';
import { toTransportViews } from '../../scripts/synthetic-test-data/toTransportViews.js';
import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import { validateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/validateSyntheticAnalysisGraph.js';
import {
  type ClassFull,
  type StudentSummary,
} from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartial } from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { AssignmentFull } from '../../src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod';
import type { ClassPartial } from '../../src/frontend/src/services/googleClassrooms/classPartials.zod';
import type {
  AssignmentTopic,
  Cohort,
  YearGroup,
} from '../../src/frontend/src/services/referenceData/referenceData.zod';

/** Full-assignment submission type derived from the production schema. */
type AssignmentSubmission = AssignmentFull['submissions'][number];

/**
 * Generator-internal observation of a profile definition.
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
 * Generator-internal observation of generated reference data. The reference-data
 * shapes themselves come from the production reference-data schema.
 */
type GeneratedReferenceData = {
  cohorts: Cohort[];
  yearGroups: YearGroup[];
  assignmentTopics: AssignmentTopic[];
};

/**
 * Generator-internal observation of a persistence assignment definition.
 */
type GeneratedDefinitionDocument = {
  definitionKey: string;
  primaryTopicKey: string;
  yearGroupKey: string;
  documentType: string;
  tasks: Record<string, unknown>;
};

/**
 * Generator-internal observation of a persistence assignment record.
 */
type GeneratedAssignmentRecord = {
  courseId: string;
  assignmentId: string;
  assignmentDefinitionKey: string;
};

/**
 * Generator-internal observation of a persistence class document.
 */
type GeneratedClassDocument = {
  classId: string;
  yearGroupKey: string | null;
  students: StudentSummary[];
};

/**
 * Generator-internal observation of the class and assignment stage output.
 */
type GeneratedAssignmentGraph = {
  classes: GeneratedClassDocument[];
  assignments: GeneratedAssignmentRecord[];
};

/**
 * Transport views typed against the real frontend service contracts.
 */
type GeneratedTransportViews = {
  classPartials: ClassPartial[];
  assignmentDefinitionPartials: AssignmentDefinitionPartial[];
  classesById: Record<string, ClassFull>;
  assignmentsByKey: Record<string, AssignmentFull>;
};

/**
 * Generator-internal observation of the top-level graph.
 */
type GeneratedSyntheticAnalysisGraph = {
  manifest: { seed: number };
  referenceData: GeneratedReferenceData;
  persistence: {
    classes: GeneratedClassDocument[];
    assignmentDefinitions: GeneratedDefinitionDocument[];
    assignments: GeneratedAssignmentRecord[];
  };
  transport: GeneratedTransportViews;
};

const SMALL_PROFILE = 'small';

const smallProfile = getProfileDefinition(SMALL_PROFILE) as GeneratedProfileDefinition;
const referenceData = generateReferenceData(smallProfile) as GeneratedReferenceData;
const assignmentDefinitions = generateAssignmentDefinitions({
  profileDefinition: smallProfile,
  referenceData,
}) as GeneratedDefinitionDocument[];
const assignmentGraph = generateAssignments({
  profileDefinition: smallProfile,
  referenceData,
  assignmentDefinitions,
}) as GeneratedAssignmentGraph;

/**
 * Builds a stable signature of the seed-varied (non-identifier) synthetic values.
 *
 * @param graph The logical graph to inspect.
 * @returns A JSON signature of generated student display values.
 */
function syntheticValueSignature(graph: GeneratedSyntheticAnalysisGraph): string {
  const values: string[] = [];

  for (const classFull of Object.values(graph.transport.classesById)) {
    for (const student of classFull.students) {
      values.push(student.name, student.email);
    }
  }

  return JSON.stringify(values);
}

describe('synthetic analysis reference data generator', () => {
  it('generates the profile year-group population deterministically', () => {
    const first = generateReferenceData(smallProfile) as GeneratedReferenceData;
    const second = generateReferenceData(smallProfile) as GeneratedReferenceData;

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.yearGroups).toHaveLength(smallProfile.yearGroupCount);
    expect(new Set(first.yearGroups.map((yearGroup) => yearGroup.key)).size).toBe(
      smallProfile.yearGroupCount
    );
  });

  it('resolves every assignment-topic year-group reference inside the reference data', () => {
    const yearGroupKeys = new Set(referenceData.yearGroups.map((yearGroup) => yearGroup.key));

    for (const topic of referenceData.assignmentTopics) {
      expect(Array.isArray(topic.yearGroupKeys)).toBe(true);
      for (const yearGroupKey of topic.yearGroupKeys) {
        expect(yearGroupKeys.has(yearGroupKey)).toBe(true);
      }
    }
  });
});

describe('synthetic analysis assignment-definition generator', () => {
  it('generates resolvable definitions with keyed tasks across both document types', () => {
    expect(assignmentDefinitions.length).toBeGreaterThan(0);

    const yearGroupKeys = new Set(referenceData.yearGroups.map((yearGroup) => yearGroup.key));
    const topicKeys = new Set(referenceData.assignmentTopics.map((topic) => topic.key));
    const documentTypes = new Set<string>();

    for (const definition of assignmentDefinitions) {
      expect(yearGroupKeys.has(definition.yearGroupKey)).toBe(true);
      expect(topicKeys.has(definition.primaryTopicKey)).toBe(true);
      expect(Object.keys(definition.tasks).length).toBeGreaterThan(0);
      documentTypes.add(definition.documentType);
    }

    expect(documentTypes.has('SLIDES')).toBe(true);
    expect(documentTypes.has('SHEETS')).toBe(true);
  });

  it('generates the same definitions for the same profile and seed', () => {
    const repeated = generateAssignmentDefinitions({
      profileDefinition: smallProfile,
      referenceData,
    }) as GeneratedDefinitionDocument[];

    expect(JSON.stringify(repeated)).toBe(JSON.stringify(assignmentDefinitions));
  });
});

describe('synthetic analysis class and assignment generator', () => {
  it('generates the exact class, roster, and assignment counts for the profile', () => {
    expect(assignmentGraph.classes).toHaveLength(smallProfile.classCount);

    for (const classDocument of assignmentGraph.classes) {
      expect(classDocument.students).toHaveLength(smallProfile.studentsPerClass);
    }

    expect(assignmentGraph.assignments).toHaveLength(
      smallProfile.classCount * smallProfile.assignmentsPerClass
    );
  });

  it('generates the same class and assignment graph for the same profile and seed', () => {
    const repeated = generateAssignments({
      profileDefinition: smallProfile,
      referenceData,
      assignmentDefinitions,
    }) as GeneratedAssignmentGraph;

    expect(JSON.stringify(repeated)).toBe(JSON.stringify(assignmentGraph));
  });
});

describe('synthetic analysis submission generator', () => {
  it('generates deterministic, roster-bound submissions for a class and definition', () => {
    const classDocument = assignmentGraph.classes[0];
    const assignmentDefinition = assignmentDefinitions[0];
    const options = {
      profileDefinition: smallProfile,
      classDocument,
      assignmentDefinition,
      assignmentId: `assignment-${classDocument.classId}-${assignmentDefinition.definitionKey}`,
      submissionCount: classDocument.students.length,
      assignmentIndex: 0,
      baseMinuteOffset: 0,
    };

    const first = generateSubmissions(options) as AssignmentSubmission[];
    const second = generateSubmissions(options) as AssignmentSubmission[];

    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(classDocument.students.length);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));

    const rosterIds = new Set(classDocument.students.map((student) => student.id));
    const declaredTaskIds = new Set(Object.keys(assignmentDefinition.tasks));

    for (const submission of first) {
      expect(rosterIds.has(submission.studentId)).toBe(true);
      for (const item of Object.values(submission.items)) {
        expect(declaredTaskIds.has(item.taskId)).toBe(true);
      }
    }
  });
});

describe('synthetic analysis transport view projector', () => {
  it('projects the persistence graph into the four named transport views', () => {
    const views = toTransportViews({
      referenceData,
      classes: assignmentGraph.classes,
      assignmentDefinitions,
      assignments: assignmentGraph.assignments,
    }) as GeneratedTransportViews;

    expect(views.classPartials).toHaveLength(assignmentGraph.classes.length);
    expect(Object.keys(views.classesById)).toHaveLength(assignmentGraph.classes.length);

    const fullDefinitionKeys = new Set(
      assignmentDefinitions
        .filter((definition) => !Array.isArray(definition.tasks))
        .map((definition) => definition.definitionKey)
    );
    const expectedFullAssignments = assignmentGraph.assignments.filter((assignment) =>
      fullDefinitionKeys.has(assignment.assignmentDefinitionKey)
    );
    expect(Object.keys(views.assignmentsByKey)).toHaveLength(expectedFullAssignments.length);
    expect(expectedFullAssignments.length).toBeGreaterThan(0);
    expect(expectedFullAssignments.length).toBeLessThan(assignmentGraph.assignments.length);
    expect(views.assignmentDefinitionPartials).toHaveLength(assignmentDefinitions.length);
  });

  it('matches the transport views composed by the top-level graph generator', () => {
    const graph = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;
    const views = toTransportViews({
      referenceData: graph.referenceData,
      classes: graph.persistence.classes,
      assignmentDefinitions: graph.persistence.assignmentDefinitions,
      assignments: graph.persistence.assignments,
    }) as GeneratedTransportViews;

    expect(views).toStrictEqual(graph.transport);
  });
});

describe('synthetic analysis graph determinism', () => {
  it('produces byte-identical logical views and manifest for the same profile and seed', () => {
    const first = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;
    const second = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.manifest.seed).toBe(smallProfile.seed);
  });

  it('changes permitted synthetic values when the seed changes while invariants hold', () => {
    const base = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;
    const altered = generateSyntheticAnalysisGraph(SMALL_PROFILE, {
      seed: smallProfile.seed + 1,
    }) as GeneratedSyntheticAnalysisGraph;

    expect(JSON.stringify(altered)).not.toBe(JSON.stringify(base));
    expect(syntheticValueSignature(altered)).not.toBe(syntheticValueSignature(base));
    expect(() => validateSyntheticAnalysisGraph(altered)).not.toThrow();
  });
});

describe('synthetic analysis graph seed validation', () => {
  it('rejects NaN as a supplied seed', () => {
    expect(() => generateSyntheticAnalysisGraph(SMALL_PROFILE, { seed: Number.NaN })).toThrow(
      /finite integer/u
    );
  });

  it('rejects an infinite supplied seed', () => {
    expect(() =>
      generateSyntheticAnalysisGraph(SMALL_PROFILE, { seed: Number.POSITIVE_INFINITY })
    ).toThrow(/finite integer/u);
  });

  it('rejects a fractional supplied seed', () => {
    expect(() => generateSyntheticAnalysisGraph(SMALL_PROFILE, { seed: 1.5 })).toThrow(
      /finite integer/u
    );
  });

  it('rejects a non-numeric supplied seed', () => {
    expect(() =>
      generateSyntheticAnalysisGraph(SMALL_PROFILE, { seed: 'seed' as unknown as number })
    ).toThrow(/finite integer/u);
  });

  it('keeps the profile seed when no override is supplied', () => {
    const graph = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;

    expect(graph.manifest.seed).toBe(smallProfile.seed);
  });
});
