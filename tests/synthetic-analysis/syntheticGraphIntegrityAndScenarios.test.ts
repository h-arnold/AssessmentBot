import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import {
  ClassFullSchema,
  PartialAssessmentScoreSchema,
  type AssignmentPartial,
  type ClassFull,
  type PartialAssessmentEntry,
  type StudentSubmissionItemPartial,
  type StudentSubmissionPartial,
} from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod';
import {
  AssignmentDefinitionPartialsResponseSchema,
  type AssignmentDefinitionPartial,
} from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { AssignmentFull } from '../../src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod';
import type {
  AssignmentTopic,
  Cohort,
  YearGroup,
} from '../../src/frontend/src/services/referenceData/referenceData.zod';

/** Full-assignment submission and item types derived from the production schema. */
type FullAssignmentSubmission = AssignmentFull['submissions'][number];
type FullAssignmentSubmissionItem = FullAssignmentSubmission['items'][string];

/**
 * Generator-internal observation of a persistence class document. Persistence is
 * not a frontend Zod contract, so only the fields this spec observes are captured.
 */
type GeneratedClassDocument = {
  classId: string;
  cohortKey: string | null;
  yearGroupKey: string | null;
  students: Array<{ id: string }>;
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
  assignmentDefinitionKey?: string;
};

/**
 * Generator-internal observation of the top-level graph. Transport views are
 * typed against the real frontend service contracts; persistence and reference
 * views are observations where no frontend schema applies.
 */
type GeneratedSyntheticAnalysisGraph = {
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

const SMALL_PROFILE = 'small';
const MEDIUM_PROFILE = 'medium';
const SLIDES_DOCUMENT_TYPE = 'SLIDES';
const SHEETS_DOCUMENT_TYPE = 'SHEETS';
const NON_APPLICABLE_SCORE = 'N';

const smallGraph = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;
const mediumGraph = generateSyntheticAnalysisGraph(
  MEDIUM_PROFILE
) as GeneratedSyntheticAnalysisGraph;

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
 * Parses every raw `getABClass` transport view through the real frontend schema.
 *
 * @param graph The generator graph carrying the raw class transport views.
 * @returns The schema-validated `ClassFull` views.
 */
function parseClassFullViews(graph: GeneratedSyntheticAnalysisGraph): ClassFull[] {
  return Object.values(graph.transport.classesById).map((classFull) =>
    ClassFullSchema.parse(classFull)
  );
}

/**
 * Identifies one logical submission item independently of the view it appears in.
 */
type ItemLocation = {
  assignmentId: string;
  studentId: string;
  taskId: string;
};

type LocatedPartialSubmissionItem = {
  location: ItemLocation;
  item: StudentSubmissionItemPartial;
};

type LocatedFullSubmissionItem = {
  location: ItemLocation;
  item: FullAssignmentSubmissionItem;
};

function itemLocationKey(location: ItemLocation): string {
  return `${location.assignmentId}::${location.studentId}::${location.taskId}`;
}

function collectPartialItemsWithLocation(
  graph: GeneratedSyntheticAnalysisGraph
): LocatedPartialSubmissionItem[] {
  return Object.values(graph.transport.classesById).flatMap((classFull) =>
    classFull.assignments.flatMap((assignment) =>
      assignment.submissions.flatMap((submission) =>
        Object.values(submission.items).map((item) => ({
          location: {
            assignmentId: assignment.assignmentId,
            studentId: submission.studentId,
            taskId: item.taskId,
          },
          item,
        }))
      )
    )
  );
}

function collectFullItemsWithLocation(
  graph: GeneratedSyntheticAnalysisGraph
): LocatedFullSubmissionItem[] {
  return Object.values(graph.transport.assignmentsByKey).flatMap((assignment) =>
    assignment.submissions.flatMap((submission) =>
      Object.values(submission.items).map((item) => ({
        location: {
          assignmentId: assignment.assignmentId,
          studentId: submission.studentId,
          taskId: item.taskId,
        },
        item,
      }))
    )
  );
}

function collectPartialItems(
  graph: GeneratedSyntheticAnalysisGraph
): StudentSubmissionItemPartial[] {
  return collectPartialItemsWithLocation(graph).map((entry) => entry.item);
}

function collectFullItems(graph: GeneratedSyntheticAnalysisGraph): FullAssignmentSubmissionItem[] {
  return collectFullItemsWithLocation(graph).map((entry) => entry.item);
}

describe('synthetic analysis graph referential integrity', () => {
  it('resolves each category reference against its own reference-data collection', () => {
    const definitions = AssignmentDefinitionPartialsResponseSchema.parse(
      smallGraph.transport.assignmentDefinitionPartials
    );
    const cohortKeys = new Set(smallGraph.referenceData.cohorts.map((cohort) => cohort.key));
    const yearGroupKeys = new Set(
      smallGraph.referenceData.yearGroups.map((yearGroup) => yearGroup.key)
    );
    const assignmentTopicKeys = new Set(
      smallGraph.referenceData.assignmentTopics.map((topic) => topic.key)
    );

    for (const classDocument of smallGraph.persistence.classes) {
      expect(classDocument.yearGroupKey).not.toBeNull();
      expect(yearGroupKeys.has(classDocument.yearGroupKey as string)).toBe(true);
      if (classDocument.cohortKey !== null) {
        expect(cohortKeys.has(classDocument.cohortKey)).toBe(true);
      }
    }

    for (const definition of definitions) {
      expect(yearGroupKeys.has(definition.yearGroupKey)).toBe(true);
      expect(assignmentTopicKeys.has(definition.primaryTopicKey)).toBe(true);
    }

    for (const topic of smallGraph.referenceData.assignmentTopics) {
      for (const yearGroupKey of topic.yearGroupKeys) {
        expect(yearGroupKeys.has(yearGroupKey)).toBe(true);
      }
    }
  });

  it('resolves every class-assignment definition key against the definition registry', () => {
    const definitionKeys = new Set(
      AssignmentDefinitionPartialsResponseSchema.parse(
        smallGraph.transport.assignmentDefinitionPartials
      ).map((definition) => definition.definitionKey)
    );

    for (const classFull of parseClassFullViews(smallGraph)) {
      for (const assignment of classFull.assignments) {
        expect(definitionKeys.has(assignment.assignmentDefinitionKey)).toBe(true);
      }
    }

    for (const assignment of smallGraph.persistence.assignments) {
      if (assignment.assignmentDefinitionKey !== undefined) {
        expect(definitionKeys.has(assignment.assignmentDefinitionKey)).toBe(true);
      }
    }
  });

  it('keeps every submission on its own class roster', () => {
    for (const classFull of parseClassFullViews(smallGraph)) {
      const rosterIds = new Set(classFull.students.map((student) => student.id));

      for (const assignment of classFull.assignments) {
        for (const submission of assignment.submissions) {
          expect(rosterIds.has(submission.studentId)).toBe(true);
        }
      }
    }
  });

  it('references only declared task IDs from each submission item', () => {
    const definitionTasks = new Map(
      AssignmentDefinitionPartialsResponseSchema.parse(
        smallGraph.transport.assignmentDefinitionPartials
      ).map((definition) => [
        definition.definitionKey,
        new Set(definition.tasks.map((task) => task.taskId)),
      ])
    );

    for (const classFull of parseClassFullViews(smallGraph)) {
      for (const assignment of classFull.assignments) {
        const taskIds = definitionTasks.get(assignment.assignmentDefinitionKey);
        if (taskIds === undefined) {
          throw new Error(`Assignment ${assignment.assignmentId} references an unknown definition`);
        }

        for (const submission of assignment.submissions) {
          for (const item of Object.values(submission.items)) {
            expect(taskIds.has(item.taskId)).toBe(true);
          }
        }
      }
    }
  });

  it('emits unique, non-empty artefact UIDs within each logical view and retains them across views', () => {
    const partialEntries = collectPartialItemsWithLocation(smallGraph);
    const fullEntries = collectFullItemsWithLocation(smallGraph);

    expect(partialEntries.length).toBeGreaterThan(0);
    expect(fullEntries.length).toBeGreaterThan(0);

    // UIDs must be unique within each logical collection; the same artefact
    // legitimately repeats across the partial and full representations.
    for (const entries of [partialEntries, fullEntries]) {
      const uids = entries.map((entry) => entry.item.artifact.uid);
      for (const uid of uids) {
        expect(typeof uid).toBe('string');
        expect(uid.length).toBeGreaterThan(0);
      }
      expect(new Set(uids).size).toBe(uids.length);
    }

    const fullItemsByLocation = new Map<string, FullAssignmentSubmissionItem>(
      fullEntries.map((entry) => [itemLocationKey(entry.location), entry.item] as const)
    );
    const fullAssignmentIds = new Set(Object.keys(smallGraph.transport.assignmentsByKey));

    for (const { location, item } of partialEntries) {
      // Partial-only assignments (those backed by a partial-only definition) have
      // no full counterpart and are therefore excluded from the full view.
      if (!fullAssignmentIds.has(location.assignmentId)) {
        continue;
      }
      const fullItem = fullItemsByLocation.get(itemLocationKey(location));
      expect(fullItem).toBeDefined();
      expect(fullItem?.artifact.uid).toBe(item.artifact.uid);
    }
  });

  it('keeps assessment and feedback maps structurally valid with schema-valid scores', () => {
    for (const item of collectPartialItems(smallGraph)) {
      for (const [criterion, assessment] of Object.entries(item.assessments ?? {})) {
        expect(criterion.length).toBeGreaterThan(0);
        expect(() => PartialAssessmentScoreSchema.parse(assessment.score)).not.toThrow();
      }

      for (const [feedbackType, feedback] of Object.entries(item.feedback ?? {})) {
        expect(feedbackType.length).toBeGreaterThan(0);
        expect(feedback).toMatchObject({ type: expect.any(String) });
        expect((feedback as { createdAt?: unknown }).createdAt).toEqual(expect.any(String));
      }
    }
  });

  it('keeps assignment and definition identifiers stable between persistence and transport', () => {
    const persistenceDefinitionKeys = new Set(
      smallGraph.persistence.assignmentDefinitions.map((definition) => definition.definitionKey)
    );
    const transportDefinitionKeys = new Set(
      smallGraph.transport.assignmentDefinitionPartials.map(
        (definition) => definition.definitionKey
      )
    );

    expect(transportDefinitionKeys.size).toBe(persistenceDefinitionKeys.size);
    for (const key of transportDefinitionKeys) {
      expect(persistenceDefinitionKeys.has(key)).toBe(true);
    }

    for (const [classId, classFull] of Object.entries(smallGraph.transport.classesById)) {
      const classDocument = smallGraph.persistence.classes.find(
        (candidate) => candidate.classId === classId
      );
      expect(classDocument).toBeDefined();
      expect(classFull.students.map((student) => student.id)).toEqual(
        classDocument?.students.map((student) => student.id)
      );
    }
  });
});

describe('synthetic analysis small and medium scenario coverage', () => {
  const graphs = [smallGraph, mediumGraph];

  it('includes both SLIDES and SHEETS assignment definitions', () => {
    for (const graph of graphs) {
      const documentTypes = new Set(
        graph.transport.assignmentDefinitionPartials.map((definition) => definition.documentType)
      );

      expect(documentTypes.has(SLIDES_DOCUMENT_TYPE)).toBe(true);
      expect(documentTypes.has(SHEETS_DOCUMENT_TYPE)).toBe(true);
    }
  });

  it('includes at least one assignment with a valid empty submissions collection', () => {
    for (const graph of graphs) {
      const hasEmptyAssignment = Object.values(graph.transport.classesById).some((classFull) =>
        classFull.assignments.some((assignment) => assignment.submissions.length === 0)
      );

      expect(hasEmptyAssignment).toBe(true);
    }
  });

  it('includes a missing-document no-submission branch with a null documentId', () => {
    for (const graph of graphs) {
      const submissions: StudentSubmissionPartial[] = Object.values(
        graph.transport.classesById
      ).flatMap((classFull) =>
        classFull.assignments.flatMap((assignment) => assignment.submissions)
      );

      expect(submissions.some((submission) => submission.documentId === null)).toBe(true);
    }
  });

  it('includes partial-assessment entries with score only and full entries with reasoning', () => {
    for (const graph of graphs) {
      const partialScoresOnly = collectPartialItems(graph).every((item) =>
        Object.values(item.assessments ?? {}).every((assessment) => !('reasoning' in assessment))
      );
      expect(partialScoresOnly).toBe(true);

      const hasPartialAssessment = collectPartialItems(graph).some(
        (item) => Object.keys(item.assessments ?? {}).length > 0
      );
      expect(hasPartialAssessment).toBe(true);

      const hasReasoning = collectFullItems(graph).some((item) =>
        Object.values(item.assessments ?? {}).some(
          (assessment) => typeof assessment.reasoning === 'string'
        )
      );
      expect(hasReasoning).toBe(true);
    }
  });

  it("includes at least one non-applicable 'N' assessment score", () => {
    for (const graph of graphs) {
      const hasNonApplicable = collectPartialItems(graph).some((item) =>
        Object.values(item.assessments ?? {}).some(
          (assessment: PartialAssessmentEntry) => assessment.score === NON_APPLICABLE_SCORE
        )
      );
      expect(hasNonApplicable).toBe(true);
    }
  });

  it('includes nullable class reference fields in the compact profiles', () => {
    for (const graph of graphs) {
      const classPartials = Object.values(graph.transport.classesById);
      expect(classPartials.some((classFull) => classFull.cohortKey === null)).toBe(true);
    }
  });

  it('includes typed task artefacts with both redacted and populated content', () => {
    for (const graph of graphs) {
      const partialItems = collectPartialItems(graph);
      expect(partialItems.length).toBeGreaterThan(0);
      expect(partialItems.every((item) => typeof item.artifact.type === 'string')).toBe(true);
      expect(partialItems.every((item) => observePartialArtifact(item).content === null)).toBe(
        true
      );
      expect(partialItems.every((item) => observePartialArtifact(item).contentHash === null)).toBe(
        true
      );

      const fullItems = collectFullItems(graph);
      expect(fullItems.some((item) => item.artifact.content !== null)).toBe(true);
      expect(fullItems.some((item) => item.artifact.contentHash !== null)).toBe(true);
    }
  });
});
