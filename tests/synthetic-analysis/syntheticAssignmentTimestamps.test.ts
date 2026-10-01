/**
 * Assignment-timestamp realism coverage for the synthetic analysis corpus.
 *
 * Pins the user-approved timestamp realism correction: every ordinary
 * generated and committed assignment carries a deterministic non-null
 * `updatedAt` exactly three minutes after `createdAt` — including each class's
 * index-zero assignment, which previously held `null` as deliberate
 * nullable-diversity data. Class-embedded partial and full transport records
 * stay exactly equal, and embedded `updatedAt` stays strictly chronological in
 * assignment-index order (oldest first) so recent-assignment slices read the
 * newest record.
 *
 * `null` remains a transport-permitted `updatedAt`: the nullable contract is
 * pinned by the cloned boundary probes below, and the class page's fail-closed
 * local rejection of a null `updatedAt` is unchanged in
 * `classPageAdapter.trustValidation.spec.ts`. Only committed compact profiles
 * are exercised; the expensive large-full graph stays with the opt-in stress
 * run.
 *
 * @see docs/developer/testing/synthetic-test-data.md
 */

import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import { loadSyntheticAnalysisProfile } from '../../scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js';
import {
  LARGE_FULL_PROFILE_NAME,
  PROFILE_NAMES,
} from '../../scripts/synthetic-test-data/profileDefinitions.js';
import { AssignmentFullSchema } from '../../src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod';
import { AssignmentPartialSchema } from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod';

/** Committed compact profiles; the large-full graph is never built here. */
const COMPACT_PROFILE_NAMES = PROFILE_NAMES.filter(
  (profileName) => profileName !== LARGE_FULL_PROFILE_NAME
);

/** Existing generator offset (minutes) from assignment creation to update. */
const MINUTES_AFTER_ASSIGNMENT_CREATED = 3;

/** Exact `createdAt` → `updatedAt` offset (`isoAt(offset + 3)`) in milliseconds. */
const UPDATE_OFFSET_MS = MINUTES_AFTER_ASSIGNMENT_CREATED * 60_000;

/** Bounded UTC ISO 8601 instant representation used by generated timestamps. */
const UTC_ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

/** Maximum offending assignments quoted in a failure message. */
const MAX_REPORTED_OFFENDERS = 5;

/** Canonical profile whose class row the null-boundary probes clone. */
const PROBE_PROFILE_NAME = 'small';

/** Canonical trustworthy class carrying the journey assignment. */
const PROBE_CLASS_ID = 'class-2';

/** Canonical index-zero assignment whose null branch motivated the correction. */
const PROBE_ASSIGNMENT_ID = 'assignment-2-0';

/** Assignment timestamp observation shared by generated and committed views. */
type ObservedAssignmentTimestamps = {
  assignmentId: string;
  createdAt: string | null;
  updatedAt: string | null;
};

/** Class observation carrying its embedded assignment timestamp rows. */
type ObservedClassAssignments = {
  classId: string;
  assignments: ObservedAssignmentTimestamps[];
};

/** Generator-internal observation of the transport views this suite reads. */
type GeneratedGraph = {
  transport: {
    classesById: Record<string, ObservedClassAssignments>;
    assignmentsByKey: Record<string, ObservedAssignmentTimestamps>;
  };
};

/** Both transport views carrying assignment timestamps for one profile. */
type AssignmentTimestampViews = {
  embeddedClasses: ObservedClassAssignments[];
  fullAssignments: ObservedAssignmentTimestamps[];
};

/** One corpus source that can supply assignment timestamp views. */
type TimestampViewSource = {
  label: 'generated' | 'committed';
  load: (profileName: string) => AssignmentTimestampViews;
};

/** Keyed timestamp pair retained by the seed-determinism snapshot. */
type TimestampSnapshotEntry = {
  createdAt: string | null;
  updatedAt: string | null;
};

/** Full determinism snapshot of one profile's assignment timestamps. */
type TimestampSnapshot = {
  embedded: Record<string, TimestampSnapshotEntry>;
  full: Record<string, TimestampSnapshotEntry>;
};

/** Narrow clone target for the canonical null-boundary probes. */
type NullProbeAssignment = {
  assignmentId: string;
  updatedAt: string | null;
};

/**
 * Loads the assignment timestamp views from a freshly generated graph.
 *
 * @param profileName Synthetic profile to generate.
 * @returns The class-embedded and full assignment timestamp views.
 */
function generatedTimestampViews(profileName: string): AssignmentTimestampViews {
  const graph = generateSyntheticAnalysisGraph(profileName) as GeneratedGraph;
  return {
    embeddedClasses: Object.values(graph.transport.classesById),
    fullAssignments: Object.values(graph.transport.assignmentsByKey),
  };
}

/**
 * Loads the assignment timestamp views from the committed compact fixtures.
 *
 * @param profileName Committed compact profile name.
 * @returns The class-embedded and full assignment timestamp views.
 */
function committedTimestampViews(profileName: string): AssignmentTimestampViews {
  return {
    embeddedClasses: Object.values(
      loadSyntheticAnalysisProfile(profileName, 'classesById') as Record<
        string,
        ObservedClassAssignments
      >
    ),
    fullAssignments: Object.values(
      loadSyntheticAnalysisProfile(profileName, 'assignmentsByKey') as Record<
        string,
        ObservedAssignmentTimestamps
      >
    ),
  };
}

/** Corpus sources under test: fresh graphs and the committed fixtures. */
const TIMESTAMP_VIEW_SOURCES: TimestampViewSource[] = [
  { label: 'generated', load: generatedTimestampViews },
  { label: 'committed', load: committedTimestampViews },
];

/**
 * Flattens both transport views into a single assignment list.
 *
 * @param views The profile views to flatten.
 * @returns Every embedded and full assignment timestamp record.
 */
function allAssignments(views: AssignmentTimestampViews): ObservedAssignmentTimestamps[] {
  return [
    ...views.embeddedClasses.flatMap((classFull) => classFull.assignments),
    ...views.fullAssignments,
  ];
}

/**
 * Formats the first offenders for a failure message.
 *
 * @param offenders The collected offender descriptions.
 * @returns A bounded, comma-separated offender list.
 */
function formatOffenders(offenders: string[]): string {
  return offenders.slice(0, MAX_REPORTED_OFFENDERS).join(', ');
}

/**
 * Asserts every assignment timestamp is a non-null, parseable UTC ISO instant.
 *
 * @param context Human-readable source/profile label for the failure message.
 * @param views The profile views to inspect.
 */
function expectRealisticAssignmentTimestamps(
  context: string,
  views: AssignmentTimestampViews
): void {
  const assignments = allAssignments(views);
  expect(assignments.length, `${context} must cover at least one assignment`).toBeGreaterThan(0);

  const offenders: string[] = [];
  for (const assignment of assignments) {
    const fields = [
      { field: 'createdAt', value: assignment.createdAt },
      { field: 'updatedAt', value: assignment.updatedAt },
    ];
    for (const { field, value } of fields) {
      if (value === null) {
        offenders.push(`${assignment.assignmentId}.${field} is null`);
      } else if (!UTC_ISO_INSTANT_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
        offenders.push(
          `${assignment.assignmentId}.${field} is not a valid UTC ISO instant ("${value}")`
        );
      }
    }
  }

  expect(
    offenders.length,
    `${context} must carry non-null valid UTC ISO assignment timestamps; first offenders: ${formatOffenders(offenders)}`
  ).toBe(0);
}

/**
 * Asserts every assignment updates exactly three minutes after creation,
 * which is the generator's existing `isoAt(offset + 3)` offset.
 *
 * @param context Human-readable source/profile label for the failure message.
 * @param views The profile views to inspect.
 */
function expectThreeMinuteUpdateOffset(context: string, views: AssignmentTimestampViews): void {
  const assignments = allAssignments(views);
  expect(assignments.length, `${context} must cover at least one assignment`).toBeGreaterThan(0);

  const offenders: string[] = [];
  for (const assignment of assignments) {
    if (assignment.createdAt === null || assignment.updatedAt === null) {
      offenders.push(
        `${assignment.assignmentId} has createdAt=${String(assignment.createdAt)} updatedAt=${String(assignment.updatedAt)}`
      );
      continue;
    }
    if (Number.isNaN(Date.parse(assignment.createdAt))) {
      offenders.push(`${assignment.assignmentId}.createdAt is not parseable`);
      continue;
    }
    const expectedUpdatedAt = new Date(
      Date.parse(assignment.createdAt) + UPDATE_OFFSET_MS
    ).toISOString();
    if (assignment.updatedAt !== expectedUpdatedAt) {
      offenders.push(
        `${assignment.assignmentId} updatedAt ${assignment.updatedAt} !== ${expectedUpdatedAt}`
      );
    }
  }

  expect(
    offenders.length,
    `${context} must set updatedAt exactly ${MINUTES_AFTER_ASSIGNMENT_CREATED} minutes after createdAt (isoAt(offset + 3)); first offenders: ${formatOffenders(offenders)}`
  ).toBe(0);
}

/**
 * Asserts embedded `updatedAt` values are strictly chronological by
 * assignment index, so index zero is the oldest and the final index the most
 * recent record a recent-assignment slice can select.
 *
 * @param context Human-readable source/profile label for the failure message.
 * @param views The profile views to inspect.
 */
function expectChronologicalIndexOrder(context: string, views: AssignmentTimestampViews): void {
  expect(views.embeddedClasses.length, `${context} must cover at least one class`).toBeGreaterThan(
    0
  );

  const offenders: string[] = [];
  let comparedPairs = 0;
  for (const classFull of views.embeddedClasses) {
    for (let index = 1; index < classFull.assignments.length; index += 1) {
      const previous = classFull.assignments[index - 1];
      const current = classFull.assignments[index];
      comparedPairs += 1;
      if (
        previous === undefined ||
        current === undefined ||
        previous.updatedAt === null ||
        current.updatedAt === null
      ) {
        offenders.push(
          `${classFull.classId} index ${index - 1}→${index} has a null updatedAt (${String(
            previous?.updatedAt
          )} → ${String(current?.updatedAt)})`
        );
        continue;
      }
      if (Date.parse(current.updatedAt) <= Date.parse(previous.updatedAt)) {
        offenders.push(
          `${classFull.classId} index ${index} updatedAt ${current.updatedAt} is not newer than index ${index - 1} updatedAt ${previous.updatedAt}`
        );
      }
    }
  }

  expect(comparedPairs, `${context} must compare at least one assignment pair`).toBeGreaterThan(0);
  expect(
    offenders.length,
    `${context} must order embedded assignment updatedAt strictly by index (oldest first); first offenders: ${formatOffenders(offenders)}`
  ).toBe(0);
}

/**
 * Snapshots every assignment timestamp into order-independent keyed records.
 *
 * @param views The profile views to snapshot.
 * @returns The embedded and full timestamp snapshots.
 */
function timestampSnapshot(views: AssignmentTimestampViews): TimestampSnapshot {
  const embedded: Record<string, TimestampSnapshotEntry> = {};
  for (const classFull of views.embeddedClasses) {
    for (const assignment of classFull.assignments) {
      embedded[`${classFull.classId}/${assignment.assignmentId}`] = {
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
      };
    }
  }

  const full: Record<string, TimestampSnapshotEntry> = {};
  for (const assignment of views.fullAssignments) {
    full[assignment.assignmentId] = {
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }

  return { embedded, full };
}

/**
 * Loads the canonical class-embedded and full records the null-boundary
 * probes clone before mutating.
 *
 * @returns The canonical index-zero assignment from both transport views.
 * @throws {Error} When the canonical probe records are absent.
 */
function loadCanonicalNullProbeRecords(): {
  embedded: NullProbeAssignment;
  full: NullProbeAssignment;
} {
  const classesById = loadSyntheticAnalysisProfile(PROBE_PROFILE_NAME, 'classesById') as Record<
    string,
    { classId: string; assignments: NullProbeAssignment[] }
  >;
  const assignmentsByKey = loadSyntheticAnalysisProfile(
    PROBE_PROFILE_NAME,
    'assignmentsByKey'
  ) as Record<string, NullProbeAssignment>;

  const probeClass = classesById[PROBE_CLASS_ID];
  if (probeClass === undefined) {
    throw new Error(
      `null updatedAt probe: class "${PROBE_CLASS_ID}" is absent from the ${PROBE_PROFILE_NAME} committed classesById view.`
    );
  }
  const embedded = probeClass.assignments.find(
    (assignment) => assignment.assignmentId === PROBE_ASSIGNMENT_ID
  );
  const full = assignmentsByKey[PROBE_ASSIGNMENT_ID];
  if (embedded === undefined || full === undefined) {
    throw new Error(
      `null updatedAt probe: assignment "${PROBE_ASSIGNMENT_ID}" is absent from the ${PROBE_PROFILE_NAME} committed views.`
    );
  }
  return { embedded, full };
}

describe('synthetic assignment timestamp realism', () => {
  it('emits non-null UTC ISO assignment timestamps in every generated and committed compact profile', () => {
    for (const source of TIMESTAMP_VIEW_SOURCES) {
      for (const profileName of COMPACT_PROFILE_NAMES) {
        expectRealisticAssignmentTimestamps(
          `${source.label} ${profileName}`,
          source.load(profileName)
        );
      }
    }
  });

  it('reproduces the committed assignment timestamps exactly from the recorded seed', () => {
    for (const profileName of COMPACT_PROFILE_NAMES) {
      expect(timestampSnapshot(generatedTimestampViews(profileName))).toEqual(
        timestampSnapshot(committedTimestampViews(profileName))
      );
    }
  });

  it('applies the existing three-minute createdAt-to-updatedAt offset on every assignment', () => {
    for (const source of TIMESTAMP_VIEW_SOURCES) {
      for (const profileName of COMPACT_PROFILE_NAMES) {
        expectThreeMinuteUpdateOffset(`${source.label} ${profileName}`, source.load(profileName));
      }
    }
  });

  it('gives every index-zero assignment a normal updatedAt at the creation offset plus three minutes', () => {
    for (const source of TIMESTAMP_VIEW_SOURCES) {
      for (const profileName of COMPACT_PROFILE_NAMES) {
        const views = source.load(profileName);
        const context = `${source.label} ${profileName}`;
        expect(
          views.embeddedClasses.length,
          `${context} must cover at least one class`
        ).toBeGreaterThan(0);

        const indexZeroViews: AssignmentTimestampViews = {
          embeddedClasses: views.embeddedClasses.map((classFull) => {
            expect(
              classFull.assignments[0],
              `${context}/${classFull.classId} must carry an index-zero assignment`
            ).toBeDefined();
            return { classId: classFull.classId, assignments: classFull.assignments.slice(0, 1) };
          }),
          fullAssignments: [],
        };
        expectThreeMinuteUpdateOffset(`${context} index-zero assignments`, indexZeroViews);
      }
    }
  });

  it('orders embedded assignment updatedAt strictly by assignment index, oldest first', () => {
    for (const source of TIMESTAMP_VIEW_SOURCES) {
      for (const profileName of COMPACT_PROFILE_NAMES) {
        expectChronologicalIndexOrder(`${source.label} ${profileName}`, source.load(profileName));
      }
    }
  });

  it('keeps embedded and full assignment timestamps exactly equal across transport views', () => {
    for (const source of TIMESTAMP_VIEW_SOURCES) {
      for (const profileName of COMPACT_PROFILE_NAMES) {
        const views = source.load(profileName);
        const fullById = new Map(
          views.fullAssignments.map((assignment) => [assignment.assignmentId, assignment])
        );
        let matchedAssignments = 0;

        for (const classFull of views.embeddedClasses) {
          for (const embedded of classFull.assignments) {
            const full = fullById.get(embedded.assignmentId);
            if (full === undefined) {
              continue;
            }
            const context = `${source.label} ${profileName}/${classFull.classId}/${embedded.assignmentId}`;
            expect(
              embedded.createdAt,
              `${context} createdAt must match across transport views`
            ).toBe(full.createdAt);
            expect(
              embedded.updatedAt,
              `${context} updatedAt must match across transport views`
            ).toBe(full.updatedAt);
            matchedAssignments += 1;
          }
        }

        expect(
          matchedAssignments,
          `${source.label} ${profileName} must cover at least one cross-view assignment`
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe('synthetic assignment null updatedAt transport contract', () => {
  it('accepts a cloned canonical class-embedded assignment partial with a null updatedAt', () => {
    const probe = structuredClone(loadCanonicalNullProbeRecords().embedded);
    // Explicit null regardless of the corpus state: the transport contract must
    // keep accepting the nullable branch after ordinary assignments gain
    // realistic timestamps.
    probe.updatedAt = null;

    const parsed = AssignmentPartialSchema.parse(probe);
    expect(parsed.updatedAt).toBeNull();
  });

  it('accepts a cloned canonical full assignment with a null updatedAt', () => {
    const probe = structuredClone(loadCanonicalNullProbeRecords().full);
    probe.updatedAt = null;

    const parsed = AssignmentFullSchema.parse(probe);
    expect(parsed.updatedAt).toBeNull();
  });
});
