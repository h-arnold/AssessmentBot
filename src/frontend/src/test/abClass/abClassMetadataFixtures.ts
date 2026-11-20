import smallPartialsRaw from '@synthetic/small/classPartials.json?raw';
import mediumPartialsRaw from '@synthetic/medium/classPartials.json?raw';
import representativePartialsRaw from '@synthetic/large-representative/classPartials.json?raw';
import { deepFreeze } from '../shared/canonicalFixturePrimitives';

export {
  CANONICAL_NON_NULL_METADATA,
  createCanonicalMetadataFixture,
} from './abClassMetadataSharedFixtures';

export type MetadataProfile = 'small' | 'medium' | 'large-representative';

/** Committed profile keys in canonical order, asserted against the selectors. */
export const METADATA_PROFILES: readonly MetadataProfile[] = [
  'small',
  'medium',
  'large-representative',
];

/** One committed class-partial record carrying canonical metadata. */
export interface MetadataSnapshotRow {
  metadata: unknown;
}

/** Parsed committed class-partial views carrying canonical metadata samples. */
export const METADATA_PROFILE_CLASS_PARTIALS = deepFreeze({
  small: JSON.parse(smallPartialsRaw) as MetadataSnapshotRow[],
  medium: JSON.parse(mediumPartialsRaw) as MetadataSnapshotRow[],
  'large-representative': JSON.parse(representativePartialsRaw) as MetadataSnapshotRow[],
} satisfies Record<MetadataProfile, MetadataSnapshotRow[]>);

/**
 * Makes a mutable copy of a canonical or locally-created metadata value.
 * @param {T} value - Value to copy.
 * @returns {T} A detached copy.
 */
export function cloneMetadata<T>(value: T): T {
  return structuredClone(value);
}

/** Canonical timestamp carried by locally built current-shape metadata probes. */
export const CURRENT_METADATA_STAMP = '2024-06-01T12:00:00.000Z';

/** Fields that distinguish the current five-field shape from the committed legacy shape. */
export const NEW_METADATA_FIELDS = [
  'baselineAverages',
  'allTaskStandings',
  'baselineStandings',
] as const;

/** Maximum number of entries permitted in each standings list. */
export const MAX_STANDINGS = 3;

const DEFAULT_PROBE_SCORE = 3;
const BASELINE_PROBE_SCORE = 2.5;

/** Loose four-score set used by locally built current-shape probes. */
export interface ProbeScores {
  completeness: unknown;
  accuracy: unknown;
  spag: unknown;
  overall: unknown;
}

/** Loose standing entry used by locally built current-shape probes. */
export interface ProbeStanding {
  studentId: unknown;
  studentName: unknown;
  scores: ProbeScores;
  recentAssignmentScores: ProbeScores[];
}

/** Loose standings object used by locally built current-shape probes. */
export interface ProbeStandings {
  top: ProbeStanding[];
  bottom: ProbeStanding[];
}

/** Baseline averages record used by locally built current-shape probes. */
export interface ProbeBaselineAverages extends ProbeScores {
  updatedAt: string;
}

/** Five-field metadata candidate whose probe values stay loosely typed for boundary tests. */
export interface CurrentMetadataCandidate {
  classAverages: unknown;
  recentAssignments: unknown[];
  baselineAverages: ProbeBaselineAverages;
  allTaskStandings: ProbeStandings;
  baselineStandings: ProbeStandings;
}

/** Committed legacy metadata row copied into a mutable plain record. */
export type LegacyMetadataRow = Record<string, unknown>;

/**
 * Builds a loose four-score set for local current-shape probes.
 * @param {unknown} value - Score value replicated across every criterion.
 * @returns {ProbeScores} A fresh loose score set.
 */
export function probeScores(value: unknown = DEFAULT_PROBE_SCORE): ProbeScores {
  return {
    completeness: value,
    accuracy: value,
    spag: value,
    overall: value,
  };
}

/**
 * Builds a loose standing entry aligned to a supplied recent-assignment count.
 * @param {unknown} studentId - Student identifier probe value.
 * @param {unknown} studentName - Student name probe value.
 * @param {number} count - Number of recent-assignment score sets to attach.
 * @param {unknown} value - Score value replicated across every criterion.
 * @returns {ProbeStanding} A fresh loose standing entry.
 */
export function probeStanding(
  studentId: unknown,
  studentName: unknown,
  count: number,
  value: unknown = DEFAULT_PROBE_SCORE
): ProbeStanding {
  return {
    studentId,
    studentName,
    scores: probeScores(value),
    recentAssignmentScores: Array.from({ length: count }, () => probeScores(value)),
  };
}

/**
 * Derives detached legacy two-field rows from a profile view by stripping any new fields.
 * @param {MetadataProfile} profile - Committed compact profile name.
 * @returns {LegacyMetadataRow[]} Detached legacy rows from the committed view.
 */
export function committedLegacyRows(profile: MetadataProfile): LegacyMetadataRow[] {
  const rows = cloneMetadata(METADATA_PROFILE_CLASS_PARTIALS[profile])
    .map((row) => row.metadata)
    .filter((metadata): metadata is LegacyMetadataRow => {
      return (
        metadata !== null &&
        typeof metadata === 'object' &&
        !Array.isArray(metadata) &&
        Array.isArray((metadata as LegacyMetadataRow).recentAssignments)
      );
    })
    .map((metadata) => {
      for (const field of NEW_METADATA_FIELDS) {
        delete metadata[field];
      }
      return metadata;
    });
  if (rows.length === 0) {
    throw new Error(`No metadata row in committed ${profile} view`);
  }
  return rows;
}

/**
 * Selects one committed legacy row carrying at least one recent assignment.
 * @param {MetadataProfile} profile - Committed compact profile name.
 * @returns {LegacyMetadataRow} A detached legacy row with recent assignments.
 */
export function committedLegacyRowWithRecent(profile: MetadataProfile): LegacyMetadataRow {
  const row = committedLegacyRows(profile).find(
    (metadata) => (metadata.recentAssignments as unknown[]).length > 0
  );
  if (!row) {
    throw new Error(`No legacy metadata row with recent assignments in committed ${profile} view`);
  }
  return row;
}

/**
 * Builds a current five-field snapshot on top of a committed legacy base.
 * @param {LegacyMetadataRow} legacy - Detached legacy metadata row from the corpus.
 * @returns {CurrentMetadataCandidate} A locally enriched current-shape candidate.
 */
export function buildCurrentMetadata(legacy: LegacyMetadataRow): CurrentMetadataCandidate {
  const cloned = structuredClone(legacy) as LegacyMetadataRow &
    Pick<CurrentMetadataCandidate, 'classAverages' | 'recentAssignments'>;
  const count = cloned.recentAssignments.length;
  return {
    ...cloned,
    baselineAverages: { ...probeScores(BASELINE_PROBE_SCORE), updatedAt: CURRENT_METADATA_STAMP },
    allTaskStandings: {
      top: [probeStanding('student-a', 'Alice', count)],
      bottom: [probeStanding('student-b', 'Bob', count)],
    },
    baselineStandings: {
      top: [probeStanding('student-c', 'Cara', count)],
      bottom: [probeStanding('student-d', 'Dan', count)],
    },
  };
}
