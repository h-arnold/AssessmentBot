/**
 * Corpus conventions for the synthetic analysis fixtures.
 *
 * One parametrised suite pins both realism conventions over every committed
 * compact view (small, medium, large-representative): assignment timestamps
 * carry a deterministic non-null `updatedAt` exactly three minutes after
 * `createdAt`, and roster student IDs are digit-only 21-character strings.
 * `null` remains a transport-permitted `updatedAt`, pinned by the local
 * null-boundary probes below; production schemas stay digit-agnostic, pinned
 * by the schema-opacity probe. A single generator-determinism probe covers
 * repeat-run equality, generated-versus-committed equality, and the
 * large-full roster convention without building the whole graph.
 *
 * @see docs/developer/testing/synthetic-test-data.md
 */

import { describe, expect, it } from 'vitest';

import { createSeededFaker } from '../../scripts/synthetic-test-data/deterministicPrimitives.js';
import { generateClassRosters } from '../../scripts/synthetic-test-data/generateClassRosters.js';
import { generateReferenceData } from '../../scripts/synthetic-test-data/generateReferenceData.js';
import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import { loadSyntheticAnalysisProfile } from '../../scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js';
import {
  LARGE_FULL_CLASS_COUNT,
  LARGE_FULL_PROFILE_NAME,
  LARGE_FULL_STUDENTS_PER_CLASS,
  PROFILE_NAMES,
  getProfileDefinition,
} from '../../scripts/synthetic-test-data/profileDefinitions.js';
import { buildClassTransportViews } from '../../scripts/synthetic-test-data/projectClassTransportViews.js';
import { AssignmentFullSchema } from '../../src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod';
import {
  AssignmentPartialSchema,
  ClassFullSchema,
} from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod';

/** Fictional 21-digit Classroom-shaped sample; never a real identifier. */
const SAMPLE_STUDENT_ID = '109876543210987654321';

/** Synthetic student-ID length, derived from the sample's 21 digits. */
const STUDENT_ID_LENGTH = SAMPLE_STUDENT_ID.length;

/** Digit-only convention applied to synthetic student IDs. */
const DIGIT_ONLY_STUDENT_ID = /^\d+$/u;

/** Exact `createdAt` → `updatedAt` offset in milliseconds. */
const UPDATE_OFFSET_MS = 3 * 60_000;

/** Bounded UTC ISO 8601 instant representation used by generated timestamps. */
const UTC_ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

/** Maximum offending values quoted in a failure message. */
const MAX_REPORTED_OFFENDERS = 5;

/** Committed compact profiles; large-full is never committed. */
const COMPACT_PROFILE_NAMES = PROFILE_NAMES.filter(
  (profileName) => profileName !== LARGE_FULL_PROFILE_NAME
);

/** Canonical probe profile/class/assignment for the local boundary probes. */
const PROBE_PROFILE_NAME = 'small';
const PROBE_CLASS_ID = 'class-2';
const PROBE_ASSIGNMENT_ID = 'assignment-2-0';

/** Assignment timestamp observation shared by both transport views. */
type ObservedAssignment = {
  assignmentId: string;
  courseId?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  submissions?: Array<{ studentId: string }>;
};

/** Class observation carrying its embedded assignments and roster. */
type ObservedClass = {
  classId: string;
  students: Array<{ id: string }>;
  assignments: ObservedAssignment[];
};

/** Generator-internal observation of the freshly generated graph. */
type GeneratedGraph = {
  persistence: { classes: ObservedClass[] };
  transport: {
    classesById: Record<string, ObservedClass>;
    assignmentsByKey: Record<string, ObservedAssignment>;
  };
};

/** Embedded and full assignment transport views for one profile. */
type CommittedAssignmentViews = {
  embedded: ObservedAssignment[];
  full: ObservedAssignment[];
};

/** Order-independent committed-versus-generated timestamp snapshot. */
type TimestampSnapshot = Record<string, { createdAt: string | null; updatedAt: string | null }>;

/**
 * Collects every roster student ID from class documents in class order.
 *
 * @param classes The class rosters to inspect.
 * @returns The roster student IDs in class order.
 */
function collectStudentIds(classes: ReadonlyArray<ObservedClass>): string[] {
  return classes.flatMap((classDocument) => classDocument.students.map((student) => student.id));
}

/**
 * Loads the committed class-embedded assignments for one compact profile.
 *
 * @param profileName Committed compact profile name.
 * @returns The embedded assignment rows in class order.
 */
function loadEmbeddedAssignments(profileName: string): ObservedAssignment[] {
  const classesById = loadSyntheticAnalysisProfile(profileName, 'classesById') as Record<
    string,
    ObservedClass
  >;
  return Object.values(classesById).flatMap((classFull) => classFull.assignments);
}

/**
 * Loads both committed assignment timestamp views for one compact profile.
 *
 * @param profileName Committed compact profile name.
 * @returns The embedded and full assignment rows.
 */
function loadCommittedAssignmentViews(profileName: string): CommittedAssignmentViews {
  return {
    embedded: loadEmbeddedAssignments(profileName),
    full: Object.values(
      loadSyntheticAnalysisProfile(profileName, 'assignmentsByKey') as Record<
        string,
        ObservedAssignment
      >
    ),
  };
}

/**
 * Collects the embedded and full assignment rows from a freshly generated graph.
 *
 * @param profileName Synthetic profile to generate.
 * @returns The embedded and full assignment rows.
 */
function loadGeneratedAssignmentViews(profileName: string): CommittedAssignmentViews {
  const graph = generateSyntheticAnalysisGraph(profileName) as GeneratedGraph;
  return {
    embedded: Object.values(graph.transport.classesById).flatMap(
      (classFull) => classFull.assignments
    ),
    full: Object.values(graph.transport.assignmentsByKey),
  };
}

/**
 * Snapshots assignment timestamps into an order-independent keyed record.
 *
 * @param profileName Committed compact profile name.
 * @param views The embedded and full assignment rows to snapshot.
 * @returns The keyed timestamp snapshot.
 */
function timestampSnapshot(
  profileName: string,
  views: CommittedAssignmentViews
): TimestampSnapshot {
  const snapshot: TimestampSnapshot = {};
  for (const assignment of views.embedded) {
    snapshot[`${profileName}/${assignment.assignmentId}`] = {
      createdAt: assignment.createdAt ?? null,
      updatedAt: assignment.updatedAt ?? null,
    };
  }
  for (const assignment of views.full) {
    snapshot[`${profileName}/${assignment.assignmentId}`] = {
      createdAt: assignment.createdAt ?? null,
      updatedAt: assignment.updatedAt ?? null,
    };
  }
  return snapshot;
}

/**
 * Asserts the digit-only string convention for a batch of student IDs.
 *
 * @param studentIds The student IDs to inspect.
 * @param context Context quoted in the failure message.
 */
function expectDigitOnlyStudentIds(studentIds: ReadonlyArray<unknown>, context: string): void {
  expect(studentIds.length, `${context} must cover at least one student ID`).toBeGreaterThan(0);
  const offenders = studentIds.filter(
    (studentId) =>
      typeof studentId !== 'string' ||
      !DIGIT_ONLY_STUDENT_ID.test(studentId) ||
      studentId.length !== STUDENT_ID_LENGTH
  );
  expect(
    offenders.length,
    `${context}: student IDs must be digit-only ${STUDENT_ID_LENGTH}-character strings; first offenders: ${JSON.stringify(
      offenders.slice(0, MAX_REPORTED_OFFENDERS)
    )}`
  ).toBe(0);
}

/**
 * Asserts non-null valid UTC ISO timestamps and the exact three-minute offset.
 *
 * @param assignments The assignment rows to inspect.
 * @param context Human-readable label for the failure message.
 */
function expectThreeMinuteAssignmentTimestamps(
  assignments: ReadonlyArray<ObservedAssignment>,
  context: string
): void {
  expect(assignments.length, `${context} must cover at least one assignment`).toBeGreaterThan(0);
  const offenders: string[] = [];
  for (const assignment of assignments) {
    const { createdAt, updatedAt } = assignment;
    if (
      typeof createdAt !== 'string' ||
      typeof updatedAt !== 'string' ||
      !UTC_ISO_INSTANT_PATTERN.test(createdAt) ||
      !UTC_ISO_INSTANT_PATTERN.test(updatedAt) ||
      Number.isNaN(Date.parse(createdAt)) ||
      Number.isNaN(Date.parse(updatedAt))
    ) {
      offenders.push(`${assignment.assignmentId} has invalid timestamps`);
      continue;
    }
    const expected = new Date(Date.parse(createdAt) + UPDATE_OFFSET_MS).toISOString();
    if (updatedAt !== expected) {
      offenders.push(`${assignment.assignmentId} updatedAt ${updatedAt} !== ${expected}`);
    }
  }
  expect(
    offenders.length,
    `${context} must set updatedAt exactly 3 minutes after createdAt; first offenders: ${offenders
      .slice(0, MAX_REPORTED_OFFENDERS)
      .join(', ')}`
  ).toBe(0);
}

/**
 * Generates only the large-full rosters, avoiding the whole 10,000-assignment graph.
 *
 * @returns The generated large-full persistence class documents.
 */
function generateLargeFullRosters(): ObservedClass[] {
  const profileDefinition = getProfileDefinition(LARGE_FULL_PROFILE_NAME);
  const faker = createSeededFaker(profileDefinition.seed);
  const referenceData = generateReferenceData(profileDefinition) as {
    cohorts: Array<{ key: string }>;
    yearGroups: Array<{ key: string }>;
  };
  return generateClassRosters({ faker, profileDefinition, referenceData }) as ObservedClass[];
}

describe('synthetic corpus assignment timestamps', () => {
  for (const profileName of COMPACT_PROFILE_NAMES) {
    it(`${profileName}: assignments carry updatedAt exactly 3 minutes after createdAt in both committed views`, () => {
      const views = loadCommittedAssignmentViews(profileName);
      expectThreeMinuteAssignmentTimestamps(
        [...views.embedded, ...views.full],
        `${profileName} committed views`
      );
    });

    it(`${profileName}: embedded updatedAt strictly increases by assignment index within each class`, () => {
      const classesById = loadSyntheticAnalysisProfile(profileName, 'classesById') as Record<
        string,
        ObservedClass
      >;
      const offenders: string[] = [];
      let comparedPairs = 0;
      for (const classFull of Object.values(classesById)) {
        for (let index = 1; index < classFull.assignments.length; index += 1) {
          comparedPairs += 1;
          const previous = classFull.assignments[index - 1];
          const current = classFull.assignments[index];
          if (
            previous?.updatedAt == null ||
            current?.updatedAt == null ||
            Date.parse(current.updatedAt) <= Date.parse(previous.updatedAt)
          ) {
            offenders.push(`${classFull.classId} index ${index}`);
          }
        }
      }
      expect(comparedPairs, `${profileName} must compare at least one pair`).toBeGreaterThan(0);
      expect(offenders.length, `${profileName} index-order offenders`).toBe(0);
    });

    it(`${profileName}: embedded and full views agree on createdAt and updatedAt per assignment`, () => {
      const views = loadCommittedAssignmentViews(profileName);
      const fullById = new Map(
        views.full.map((assignment) => [assignment.assignmentId, assignment])
      );
      let matched = 0;
      for (const embedded of views.embedded) {
        const full = fullById.get(embedded.assignmentId);
        if (full === undefined) {
          continue;
        }
        expect(embedded.createdAt).toBe(full.createdAt);
        expect(embedded.updatedAt).toBe(full.updatedAt);
        matched += 1;
      }
      expect(
        matched,
        `${profileName} must cover at least one cross-view assignment`
      ).toBeGreaterThan(0);
    });
  }
});

describe('synthetic corpus student identifiers', () => {
  for (const profileName of COMPACT_PROFILE_NAMES) {
    it(`${profileName}: roster and submission student IDs are digit-only 21-character strings`, () => {
      const classesById = loadSyntheticAnalysisProfile(profileName, 'classesById') as Record<
        string,
        ObservedClass
      >;
      const assignmentsByKey = loadSyntheticAnalysisProfile(
        profileName,
        'assignmentsByKey'
      ) as Record<string, ObservedAssignment>;

      expectDigitOnlyStudentIds(
        collectStudentIds(Object.values(classesById)),
        `${profileName} classesById roster`
      );
      expectDigitOnlyStudentIds(
        Object.values(assignmentsByKey).flatMap((assignment) =>
          (assignment.submissions ?? []).map((submission) => submission.studentId)
        ),
        `${profileName} assignmentsByKey submissions`
      );
    });

    it(`${profileName}: roster IDs are unique across classes and every submission student is rostered`, () => {
      const classesById = loadSyntheticAnalysisProfile(profileName, 'classesById') as Record<
        string,
        ObservedClass
      >;
      const assignmentsByKey = loadSyntheticAnalysisProfile(
        profileName,
        'assignmentsByKey'
      ) as Record<string, ObservedAssignment>;

      const rosterIds = collectStudentIds(Object.values(classesById));
      expect(new Set(rosterIds).size, `${profileName} roster IDs must be unique`).toBe(
        rosterIds.length
      );
      for (const assignment of Object.values(assignmentsByKey)) {
        const roster = classesById[assignment.courseId ?? ''];
        expect(
          roster,
          `${profileName}/${assignment.assignmentId} must reference a known class`
        ).toBeDefined();
        const rostered = new Set(roster?.students.map((student) => student.id));
        for (const submission of assignment.submissions ?? []) {
          expect(rostered.has(submission.studentId)).toBe(true);
        }
      }
    });

    it(`${profileName}: committed roster IDs survive JSON round trip and exact integer reads`, () => {
      const classesById = loadSyntheticAnalysisProfile(profileName, 'classesById') as Record<
        string,
        ObservedClass
      >;
      for (const studentId of collectStudentIds(Object.values(classesById))) {
        expect(JSON.parse(JSON.stringify(studentId))).toBe(studentId);
        expect(BigInt(studentId).toString()).toBe(studentId);
      }
    });

    it(`${profileName}: classPartials list exactly the classesById roster owners`, () => {
      const classPartials = loadSyntheticAnalysisProfile(profileName, 'classPartials') as Array<{
        classId: string;
      }>;
      const classesById = loadSyntheticAnalysisProfile(profileName, 'classesById') as Record<
        string,
        ObservedClass
      >;
      expect(classPartials.map((partial) => partial.classId).sort()).toEqual(
        Object.keys(classesById).sort()
      );
    });
  }
});

describe('synthetic corpus generator determinism probe', () => {
  it('reproduces committed compact graphs and large-full rosters deterministically from their seeds', () => {
    for (const profileName of COMPACT_PROFILE_NAMES) {
      const first = generateSyntheticAnalysisGraph(profileName) as GeneratedGraph;
      const second = generateSyntheticAnalysisGraph(profileName) as GeneratedGraph;
      const firstRoster = collectStudentIds(first.persistence.classes);
      const secondRoster = collectStudentIds(second.persistence.classes);
      expect(secondRoster).toEqual(firstRoster);
      expect(timestampSnapshot(profileName, loadGeneratedAssignmentViews(profileName))).toEqual(
        timestampSnapshot(profileName, loadCommittedAssignmentViews(profileName))
      );
      const committedClasses = Object.values(
        loadSyntheticAnalysisProfile(profileName, 'classesById') as Record<string, ObservedClass>
      );
      expect(collectStudentIds(committedClasses)).toEqual(firstRoster);
    }

    const largeFullRosters = generateLargeFullRosters();
    const largeFullIds = collectStudentIds(largeFullRosters);
    expect(largeFullIds.length).toBe(LARGE_FULL_CLASS_COUNT * LARGE_FULL_STUDENTS_PER_CLASS);
    expectDigitOnlyStudentIds(largeFullIds, 'large-full generated roster');
    expect(new Set(largeFullIds).size).toBe(largeFullIds.length);
    expect(collectStudentIds(generateLargeFullRosters())).toEqual(largeFullIds);
  });
});

describe('synthetic corpus transport contract probes', () => {
  it('accepts a null updatedAt on class-embedded partial and full assignment transport records', () => {
    const classesById = loadSyntheticAnalysisProfile(PROBE_PROFILE_NAME, 'classesById') as Record<
      string,
      ObservedClass
    >;
    const assignmentsByKey = loadSyntheticAnalysisProfile(
      PROBE_PROFILE_NAME,
      'assignmentsByKey'
    ) as Record<string, ObservedAssignment>;
    const embedded = structuredClone(
      classesById[PROBE_CLASS_ID]?.assignments.find(
        (assignment) => assignment.assignmentId === PROBE_ASSIGNMENT_ID
      )
    );
    const full = structuredClone(assignmentsByKey[PROBE_ASSIGNMENT_ID]);
    expect(embedded).toBeDefined();
    expect(full).toBeDefined();

    if (embedded !== undefined) {
      embedded.updatedAt = null;
      expect(AssignmentPartialSchema.parse(embedded).updatedAt).toBeNull();
    }
    if (full !== undefined) {
      full.updatedAt = null;
      expect(AssignmentFullSchema.parse(full).updatedAt).toBeNull();
    }
  });

  it('preserves a live-shaped 21-digit student ID and keeps the schema opaque to digit formatting', () => {
    const classesById = loadSyntheticAnalysisProfile(PROBE_PROFILE_NAME, 'classesById') as Record<
      string,
      ObservedClass
    >;
    const probeClass = structuredClone(classesById[PROBE_CLASS_ID]);
    expect(probeClass).toBeDefined();
    const probeStudent = probeClass?.students[0];
    expect(probeStudent).toBeDefined();
    if (probeClass === undefined || probeStudent === undefined) {
      return;
    }

    probeStudent.id = SAMPLE_STUDENT_ID;
    const projected = buildClassTransportViews([probeClass], [], new Map());
    const projectedClass = (projected.classesById as Record<string, unknown>)[PROBE_CLASS_ID];
    const parsedClass = ClassFullSchema.parse(JSON.parse(JSON.stringify(projectedClass)));
    const parsedId = parsedClass.students[0]?.id;
    expect(parsedId).toBe(SAMPLE_STUDENT_ID);
    expect(BigInt(parsedId ?? '0').toString()).toBe(SAMPLE_STUDENT_ID);

    probeClass.students[0].id = 'opaque-student-id';
    const opaqueParsed = ClassFullSchema.parse(JSON.parse(JSON.stringify(probeClass)));
    expect(opaqueParsed.students[0]?.id).toBe('opaque-student-id');
  });
});
