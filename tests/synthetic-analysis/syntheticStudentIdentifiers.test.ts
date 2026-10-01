/**
 * Student-identifier coverage for the synthetic analysis corpus.
 *
 * Pins the approved realism convention: synthetic roster student IDs are
 * digit-only strings of 21 characters, matching the shape of the approved
 * fictional Classroom identifier sample `109876543210987654321`. Official Classroom
 * `UserProfile.id` and `Student.userId` remain opaque string contracts with no
 * guaranteed length or digit-only validation, so these assertions constrain
 * the corpus only — the production schemas stay digit-agnostic, which the
 * schema-opacity probe below pins explicitly.
 *
 * Coverage: generated and committed rosters, the roster-only large-full
 * profile generated through `generateClassRosters` rather than the whole
 * graph, per-profile uniqueness, deterministic repeat, exact JSON precision,
 * compact cross-view roster linkage and a narrow live-shaped precision probe
 * through the class transport projection and `ClassFullSchema`.
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
import { ClassFullSchema } from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod';

/**
 * Fictional 21-digit Classroom-shaped student identifier sample used for
 * realism calibration. Never store a real user identifier here.
 */
const SAMPLE_STUDENT_ID = '109876543210987654321';

/** Synthetic student-ID length, derived from the sample's 21 digits. */
const STUDENT_ID_LENGTH = SAMPLE_STUDENT_ID.length;

/** Digit-only convention applied to synthetic student IDs. */
const DIGIT_ONLY_STUDENT_ID = /^\d+$/u;

/** Committed class row used by the live-shaped precision probe. */
const PROBE_CLASS_ID = 'class-2';

/** Committed profile whose roster the live-shaped probe mutates locally. */
const PROBE_PROFILE_NAME = 'small';

/** Deterministic profile used for the repeat-run determinism probe. */
const DETERMINISM_PROFILE_NAME = 'small';

/** Maximum offending identifiers quoted in a failure message. */
const MAX_REPORTED_OFFENDERS = 5;

/** Committed compact profile names; the large-full profile is never committed. */
const COMMITTED_PROFILE_NAMES = PROFILE_NAMES.filter(
  (profileName) => profileName !== LARGE_FULL_PROFILE_NAME
);

/** Roster student observation shared by generated and committed views. */
type ObservedStudent = { id: string };

/** Class observation carrying the roster this suite asserts on. */
type ObservedClassRoster = { students: ObservedStudent[] };

/** Generator-internal observation of the freshly generated graph. */
type GeneratedSyntheticAnalysisGraph = {
  persistence: { classes: ObservedClassRoster[] };
};

/** Committed full-class transport observation. */
type ObservedClassFull = ObservedClassRoster & { classId: string };

/** Committed assignment transport observation. */
type ObservedAssignment = {
  assignmentId: string;
  courseId: string;
  submissions: Array<{ studentId: string }>;
};

/** Committed class-partial transport observation. */
type ObservedClassPartial = { classId: string };

/** Reference-data shape the roster generator consumes. */
type RosterReferenceData = {
  cohorts: Array<{ key: string }>;
  yearGroups: Array<{ key: string }>;
};

/**
 * Collects every roster student ID from class documents in class order.
 *
 * @param classes The class rosters to inspect.
 * @returns The roster student IDs in class order.
 */
function collectStudentIds(classes: ReadonlyArray<ObservedClassRoster>): string[] {
  const studentIds: string[] = [];
  for (const classDocument of classes) {
    for (const student of classDocument.students) {
      studentIds.push(student.id);
    }
  }
  return studentIds;
}

/**
 * Loads the committed full-class transport view for one compact profile.
 *
 * @param profileName Committed compact profile name.
 * @returns The class records keyed by class identifier.
 */
function loadClassesById(profileName: string): Record<string, ObservedClassFull> {
  return loadSyntheticAnalysisProfile(profileName, 'classesById') as Record<
    string,
    ObservedClassFull
  >;
}

/**
 * Loads the committed assignment transport view for one compact profile.
 *
 * @param profileName Committed compact profile name.
 * @returns The assignment records keyed by assignment identifier.
 */
function loadAssignmentsByKey(profileName: string): Record<string, ObservedAssignment> {
  return loadSyntheticAnalysisProfile(profileName, 'assignmentsByKey') as Record<
    string,
    ObservedAssignment
  >;
}

/**
 * Generates only the large-full rosters, so the 3,000-student roster
 * convention is covered without building the whole 10,000-assignment graph.
 *
 * @returns The generated large-full persistence class documents.
 */
function generateLargeFullRosters(): ObservedClassRoster[] {
  const profileDefinition = getProfileDefinition(LARGE_FULL_PROFILE_NAME);
  const faker = createSeededFaker(profileDefinition.seed);
  // The generator's own JSDoc declares `object` element types; the roster
  // generator documents the narrower keyed shape it actually reads.
  const referenceData = generateReferenceData(profileDefinition) as RosterReferenceData;
  return generateClassRosters({ faker, profileDefinition, referenceData }) as ObservedClassRoster[];
}

/**
 * Asserts the digit-only string convention for a batch of student IDs.
 *
 * @param studentIds The student IDs to inspect.
 * @param context Context quoted in the failure message.
 */
function expectDigitOnlyStudentIds(studentIds: ReadonlyArray<unknown>, context: string): void {
  expect(studentIds.length, `${context} must cover at least one student ID`).toBeGreaterThan(0);

  const nonStrings = studentIds.filter((studentId) => typeof studentId !== 'string');
  expect(
    nonStrings.length,
    `${context}: student IDs must stay strings with no numeric conversion; first offenders: ${JSON.stringify(
      nonStrings.slice(0, MAX_REPORTED_OFFENDERS)
    )}`
  ).toBe(0);

  const offenders = studentIds.filter(
    (studentId) =>
      typeof studentId === 'string' &&
      (!DIGIT_ONLY_STUDENT_ID.test(studentId) || studentId.length !== STUDENT_ID_LENGTH)
  );
  expect(
    offenders.length,
    `${context}: student IDs must be digit-only ${STUDENT_ID_LENGTH}-character strings; first offenders: ${JSON.stringify(
      offenders.slice(0, MAX_REPORTED_OFFENDERS)
    )}`
  ).toBe(0);
}

describe('synthetic student identifier convention', () => {
  it('generates digit-only 21-character string student IDs for every committed profile roster', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const graph = generateSyntheticAnalysisGraph(profileName) as GeneratedSyntheticAnalysisGraph;
      expectDigitOnlyStudentIds(
        collectStudentIds(graph.persistence.classes),
        `${profileName} generated roster`
      );
    }
  });

  it('generates digit-only 21-character string student IDs for the large-full roster without building the full graph', () => {
    const studentIds = collectStudentIds(generateLargeFullRosters());
    expect(studentIds.length, 'large-full generated roster must cover every class roster').toBe(
      LARGE_FULL_CLASS_COUNT * LARGE_FULL_STUDENTS_PER_CLASS
    );
    expectDigitOnlyStudentIds(studentIds, 'large-full generated roster');
  });

  it('keeps roster student IDs unique across every class in a profile', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const graph = generateSyntheticAnalysisGraph(profileName) as GeneratedSyntheticAnalysisGraph;
      const studentIds = collectStudentIds(graph.persistence.classes);
      expect(
        new Set(studentIds).size,
        `${profileName} roster student IDs must be unique across its classes`
      ).toBe(studentIds.length);
    }

    const largeFullStudentIds = collectStudentIds(generateLargeFullRosters());
    expect(
      new Set(largeFullStudentIds).size,
      'large-full roster student IDs must be unique across its classes'
    ).toBe(largeFullStudentIds.length);
  });

  it('regenerates identical roster student IDs across repeat runs', () => {
    const firstRun = generateSyntheticAnalysisGraph(
      DETERMINISM_PROFILE_NAME
    ) as GeneratedSyntheticAnalysisGraph;
    const secondRun = generateSyntheticAnalysisGraph(
      DETERMINISM_PROFILE_NAME
    ) as GeneratedSyntheticAnalysisGraph;

    expect(collectStudentIds(secondRun.persistence.classes)).toEqual(
      collectStudentIds(firstRun.persistence.classes)
    );

    const firstLargeFullRun = collectStudentIds(generateLargeFullRosters());
    const secondLargeFullRun = collectStudentIds(generateLargeFullRosters());
    expect(secondLargeFullRun).toEqual(firstLargeFullRun);
  });
});

describe('synthetic student identifier precision', () => {
  it('round-trips every committed roster student ID through JSON as an exact digit string', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const studentIds = collectStudentIds(Object.values(loadClassesById(profileName)));
      expectDigitOnlyStudentIds(studentIds, `${profileName} committed roster`);

      for (const studentId of studentIds) {
        expect(
          JSON.parse(JSON.stringify(studentId)),
          `${profileName}: JSON round trip must preserve "${studentId}"`
        ).toBe(studentId);
        expect(
          BigInt(studentId).toString(),
          `${profileName}: "${studentId}" must survive an exact integer read`
        ).toBe(studentId);
      }
    }
  });

  it('preserves a live-shaped 21-digit student ID through the class transport projection and schema', () => {
    const classesById = loadClassesById(PROBE_PROFILE_NAME);
    const probeClass = structuredClone(classesById[PROBE_CLASS_ID]);
    if (probeClass == null) {
      throw new Error(
        `student identifier probe: class "${PROBE_CLASS_ID}" is absent from the ${PROBE_PROFILE_NAME} committed classesById view.`
      );
    }
    const probeStudent = probeClass.students[0];
    if (probeStudent == null) {
      throw new Error(
        `student identifier probe: class "${PROBE_CLASS_ID}" carries no students to probe.`
      );
    }
    // Local boundary mutation of a cloned canonical record: the live-shaped
    // sample stands in for the roster ID so the projection and schema are
    // measured against a value that exceeds Number.MAX_SAFE_INTEGER.
    probeStudent.id = SAMPLE_STUDENT_ID;

    const projected = buildClassTransportViews([probeClass], [], new Map());
    const projectedClasses = projected.classesById as Record<string, unknown>;
    const projectedClass = projectedClasses[PROBE_CLASS_ID];
    if (projectedClass == null) {
      throw new Error(
        `student identifier probe: projection produced no record for class "${PROBE_CLASS_ID}".`
      );
    }

    const parsedClass = ClassFullSchema.parse(JSON.parse(JSON.stringify(projectedClass)));
    const parsedStudentId = parsedClass.students[0]?.id;

    expect(parsedStudentId, 'the projected roster must keep the live-shaped ID').toBe(
      SAMPLE_STUDENT_ID
    );
    expect(typeof parsedStudentId).toBe('string');
    expect(
      parsedStudentId == null ? null : BigInt(parsedStudentId).toString(),
      'the live-shaped ID must survive projection and validation without precision loss'
    ).toBe(SAMPLE_STUDENT_ID);
  });

  it('keeps the production student ID schema opaque to digit formatting', () => {
    const classesById = loadClassesById(PROBE_PROFILE_NAME);
    const probeClass = structuredClone(classesById[PROBE_CLASS_ID]);
    if (probeClass == null) {
      throw new Error(
        `student identifier probe: class "${PROBE_CLASS_ID}" is absent from the ${PROBE_PROFILE_NAME} committed classesById view.`
      );
    }
    const probeStudent = probeClass.students[0];
    if (probeStudent == null) {
      throw new Error(
        `student identifier probe: class "${PROBE_CLASS_ID}" carries no students to probe.`
      );
    }
    // Deliberately local, non-digit boundary value: the production schema must
    // stay an opaque string contract with no digit-only validation.
    probeStudent.id = 'opaque-student-id';

    const parsedClass = ClassFullSchema.parse(JSON.parse(JSON.stringify(probeClass)));

    expect(parsedClass.students[0]?.id).toBe('opaque-student-id');
  });
});

describe('synthetic student identifier cross-view linkage', () => {
  it('links every assignmentsByKey submission student to the classesById roster of its class', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const classesById = loadClassesById(profileName);
      const assignmentsByKey = loadAssignmentsByKey(profileName);

      for (const assignment of Object.values(assignmentsByKey)) {
        const roster = classesById[assignment.courseId];
        if (roster == null) {
          throw new Error(
            `${profileName}: assignment "${assignment.assignmentId}" references unknown class "${assignment.courseId}".`
          );
        }
        const rosteredStudentIds = new Set(roster.students.map((student) => student.id));
        for (const submission of assignment.submissions) {
          expect(
            rosteredStudentIds.has(submission.studentId),
            `${profileName}/${assignment.assignmentId}: submission student "${submission.studentId}" must be rostered in "${assignment.courseId}"`
          ).toBe(true);
        }
      }
    }
  });

  it('carries the digit-only 21-character convention across the committed class and assignment views', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const classesById = loadClassesById(profileName);
      const assignmentsByKey = loadAssignmentsByKey(profileName);

      expectDigitOnlyStudentIds(
        collectStudentIds(Object.values(classesById)),
        `${profileName} committed classesById roster`
      );
      expectDigitOnlyStudentIds(
        Object.values(assignmentsByKey).flatMap((assignment) =>
          assignment.submissions.map((submission) => submission.studentId)
        ),
        `${profileName} committed assignmentsByKey submissions`
      );
    }
  });

  it('keeps classPartials class identifiers aligned with the classesById roster owners', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const classPartials = loadSyntheticAnalysisProfile(
        profileName,
        'classPartials'
      ) as ObservedClassPartial[];
      const classesById = loadClassesById(profileName);

      expect(
        classPartials.map((partial) => partial.classId).sort(),
        `${profileName}: classPartials must list exactly the classesById roster owners`
      ).toEqual(Object.keys(classesById).sort());
    }
  });
});
