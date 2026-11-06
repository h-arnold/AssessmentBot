import { describe, expect, it } from 'vitest';

import { deriveLegacyAssignmentScenario } from '#synthetic-data/deriveLegacyAssignmentScenario.js';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';

// Red-phase suite for the test-only legacy scenario derivation (green-phase work).
// Pins explicit profile/assignment/variant selection, linked full and class-embedded
// forms, marker handling, determinism, independent copies and frozen-input safety.

type JsonRecord = Record<string, any>;

type Sources = {
  classesById: Record<string, JsonRecord>;
  assignmentsByKey: Record<string, JsonRecord>;
};

type LegacyScenario = {
  classId: string;
  classView: JsonRecord;
  assignmentsByKey: Record<string, JsonRecord>;
  full: JsonRecord;
  classEmbedded: JsonRecord;
};

const MARKER = 'assessmentContractVersion';
const LEGACY_MARKER = 'legacy';
const STORED = 'stored';
const READ = 'read';
const SMALL_PROFILE = 'small';
const MEDIUM_PROFILE = 'medium';
const SMALL_CLASS_ID = 'class-0';
const SMALL_ASSIGNMENT_ID = 'assignment-0-1';
const MEDIUM_CLASS_ID = 'class-0';
const MEDIUM_ASSIGNMENT_ID = 'assignment-0-2';
const UNKNOWN_ASSIGNMENT_ID = 'assignment-0-99';
const ASSESSMENT_FAILED = 'ASSESSMENT_FAILED';
const SOURCE_UNREADABLE = 'SOURCE_UNREADABLE';

// Loads the two canonical transport views that carry both assignment forms.
function loadSources(profileName: string): Sources {
  return {
    classesById: loadSyntheticAnalysisProfile(profileName, 'classesById') as Record<
      string,
      JsonRecord
    >,
    assignmentsByKey: loadSyntheticAnalysisProfile(profileName, 'assignmentsByKey') as Record<
      string,
      JsonRecord
    >,
  };
}

// Derives one legacy scenario, typed for the assertions below.
function scenario(config: {
  profileName: string;
  assignmentId: string;
  variant: string;
  sources: Sources;
}): LegacyScenario {
  return deriveLegacyAssignmentScenario(config) as LegacyScenario;
}

// Derives the primary small-profile scenario for one explicit variant.
function deriveSmall(variant: string, sources: Sources): LegacyScenario {
  return scenario({
    profileName: SMALL_PROFILE,
    assignmentId: SMALL_ASSIGNMENT_ID,
    variant,
    sources,
  });
}

// Copies a record without its assessment-contract marker.
function withoutMarker(form: JsonRecord): JsonRecord {
  const copy = { ...form };
  delete copy[MARKER];
  return copy;
}

// Asserts a derived form matches its canonical record on every field except the marker.
function expectRetainsCanonicalFields(derived: JsonRecord, canonical: JsonRecord): void {
  expect(withoutMarker(derived)).toEqual(withoutMarker(canonical));
}

// Asserts every sibling assignment in a class view still matches the canonical record.
function expectClassSiblingsUnchanged(
  derivedClassView: JsonRecord,
  canonicalClassView: JsonRecord,
  selectedAssignmentId: string
): void {
  for (const canonical of canonicalClassView.assignments as JsonRecord[]) {
    if (canonical.assignmentId === selectedAssignmentId) continue;
    const derived = (derivedClassView.assignments as JsonRecord[]).find(
      (candidate) => candidate.assignmentId === canonical.assignmentId
    );
    expect(derived).toEqual(canonical);
  }
}

// Asserts every sibling standalone full assignment still matches the canonical record.
function expectFullSiblingsUnchanged(
  derivedByKey: Record<string, JsonRecord>,
  canonicalByKey: Record<string, JsonRecord>,
  selectedAssignmentId: string
): void {
  for (const [key, canonical] of Object.entries(canonicalByKey)) {
    if (key === selectedAssignmentId) continue;
    expect(derivedByKey[key]).toEqual(canonical);
  }
}

// Asserts every node in a value graph is frozen.
function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value as Record<string, unknown>)) {
    expectDeepFrozen(child);
  }
}

// Collects every assessment error code present in a submission list.
function collectErrorCodes(submissions: JsonRecord[]): string[] {
  const codes: string[] = [];
  for (const submission of submissions) {
    for (const item of Object.values(submission.items) as JsonRecord[]) {
      for (const assessment of Object.values(item.assessments) as JsonRecord[]) {
        if (assessment.error && typeof assessment.error.code === 'string') {
          codes.push(assessment.error.code);
        }
      }
    }
  }
  return codes;
}

// Reports whether any submission carries a null-source SOURCE_UNREADABLE item.
function hasNullSourceUnreadable(submissions: JsonRecord[]): boolean {
  for (const submission of submissions) {
    for (const item of Object.values(submission.items) as JsonRecord[]) {
      if (item.artifact.content !== null) continue;
      for (const assessment of Object.values(item.assessments) as JsonRecord[]) {
        if (assessment.error?.code === SOURCE_UNREADABLE) return true;
      }
    }
  }
  return false;
}

describe('legacy assignment scenario derivation', () => {
  describe('linked forms', () => {
    it('derives linked full and class-embedded forms of the selected assignment', () => {
      const sources = loadSources(SMALL_PROFILE);
      const result = deriveSmall(STORED, sources);
      const canonicalClassView = sources.classesById[SMALL_CLASS_ID];
      const canonicalFull = sources.assignmentsByKey[SMALL_ASSIGNMENT_ID];
      const canonicalClassEmbedded = (canonicalClassView.assignments as JsonRecord[]).find(
        (assignment) => assignment.assignmentId === SMALL_ASSIGNMENT_ID
      );
      expect(canonicalClassEmbedded).toBeDefined();

      expect(result.classId).toBe(SMALL_CLASS_ID);
      expect(result.full.assignmentId).toBe(SMALL_ASSIGNMENT_ID);
      expect(result.classEmbedded.assignmentId).toBe(SMALL_ASSIGNMENT_ID);
      expect(result.full.submissions.length).toBeGreaterThan(0);
      expectRetainsCanonicalFields(result.full, canonicalFull);
      expectRetainsCanonicalFields(result.classEmbedded, canonicalClassEmbedded!);

      const fullStudents = (result.full.submissions as JsonRecord[]).map((row) => row.studentId);
      const embeddedStudents = (result.classEmbedded.submissions as JsonRecord[]).map(
        (row) => row.studentId
      );
      expect(fullStudents.sort()).toEqual(embeddedStudents.sort());
    });
  });

  describe('marker handling', () => {
    it('omits the stored marker on both forms and leaves sibling assignments untouched', () => {
      const sources = loadSources(SMALL_PROFILE);
      const result = deriveSmall(STORED, sources);

      expect(Object.hasOwn(result.full, MARKER)).toBe(false);
      expect(Object.hasOwn(result.classEmbedded, MARKER)).toBe(false);
      expectClassSiblingsUnchanged(
        result.classView,
        sources.classesById[SMALL_CLASS_ID],
        SMALL_ASSIGNMENT_ID
      );
      expectFullSiblingsUnchanged(
        result.assignmentsByKey,
        sources.assignmentsByKey,
        SMALL_ASSIGNMENT_ID
      );
    });

    it('stamps the read marker as legacy on both forms and leaves sibling assignments untouched', () => {
      const sources = loadSources(SMALL_PROFILE);
      const result = deriveSmall(READ, sources);

      expect(result.full[MARKER]).toBe(LEGACY_MARKER);
      expect(result.classEmbedded[MARKER]).toBe(LEGACY_MARKER);
      expectClassSiblingsUnchanged(
        result.classView,
        sources.classesById[SMALL_CLASS_ID],
        SMALL_ASSIGNMENT_ID
      );
      expectFullSiblingsUnchanged(
        result.assignmentsByKey,
        sources.assignmentsByKey,
        SMALL_ASSIGNMENT_ID
      );
    });
  });

  describe('determinism and isolation', () => {
    it('produces deterministic, independently owned outputs', () => {
      const sources = loadSources(SMALL_PROFILE);
      const first = deriveSmall(STORED, sources);
      const second = deriveSmall(STORED, sources);
      const read = deriveSmall(READ, sources);

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first.full).not.toBe(second.full);

      const secondSnapshot = structuredClone(second.full);
      const readSnapshot = structuredClone(read.full);
      const firstSubmission = (first.full.submissions as JsonRecord[])[0];
      const firstTaskId = Object.keys(firstSubmission.items)[0];
      (firstSubmission.items[firstTaskId].artifact as JsonRecord).content = 'mutated content';

      expect(second.full).toEqual(secondSnapshot);
      expect(read.full).toEqual(readSnapshot);
    });

    it('does not mutate the deep-frozen canonical input', () => {
      const sources = loadSources(SMALL_PROFILE);
      const snapshot = structuredClone(sources);
      deriveSmall(STORED, sources);
      deriveSmall(READ, sources);

      // The loader-owned views are the frozen canonical input; the wrapper is
      // assembled by this test and is not itself frozen.
      expectDeepFrozen(sources.classesById);
      expectDeepFrozen(sources.assignmentsByKey);
      expect(sources).toEqual(snapshot);
    });
  });

  describe('invalid selection', () => {
    it('throws naming the missing selection when the assignment is unknown', () => {
      const sources = loadSources(SMALL_PROFILE);
      expect(() =>
        scenario({
          profileName: SMALL_PROFILE,
          assignmentId: UNKNOWN_ASSIGNMENT_ID,
          variant: READ,
          sources,
        })
      ).toThrow(new RegExp(UNKNOWN_ASSIGNMENT_ID, 'u'));
    });
  });

  describe('mixed outcomes profile', () => {
    it('keeps explicit E and null-parent records unchanged apart from the marker', () => {
      const sources = loadSources(MEDIUM_PROFILE);
      const result = scenario({
        profileName: MEDIUM_PROFILE,
        assignmentId: MEDIUM_ASSIGNMENT_ID,
        variant: READ,
        sources,
      });
      const canonicalFull = sources.assignmentsByKey[MEDIUM_ASSIGNMENT_ID];
      const submissions = result.full.submissions as JsonRecord[];

      expect(result.full[MARKER]).toBe(LEGACY_MARKER);
      expect(result.classId).toBe(MEDIUM_CLASS_ID);
      expectRetainsCanonicalFields(result.full, canonicalFull);
      expect(collectErrorCodes(submissions)).toContain(ASSESSMENT_FAILED);
      expect(hasNullSourceUnreadable(submissions)).toBe(true);
    });
  });
});
