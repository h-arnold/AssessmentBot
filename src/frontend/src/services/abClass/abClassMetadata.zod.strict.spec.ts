import { describe, expect, it } from 'vitest';
import { ABClassMetadataSchema } from './abClassMetadata.zod';
import {
  CANONICAL_METADATA_TIMESTAMP,
  DEFAULT_CLASS_AVERAGES,
  DEFAULT_ENTRY_AVERAGES,
  DEFAULT_SCORES,
  asScratchPad,
  metadataCandidate,
  metadataWithSingleEntry,
  recentAssignment,
  withRootSymbolKey,
  type MetadataCandidateValues,
  type RecordScratchPad,
} from '@/test/abClass/abClassMetadataTestBuilders';

/**
 * Wraps a raw candidate for schema safeParse, shared by every probe loop.
 * @param {unknown} candidate - Raw candidate to validate.
 * @returns {boolean} Whether the schema accepts the candidate.
 */
function isAccepted(candidate: unknown): boolean {
  return ABClassMetadataSchema.safeParse(candidate).success;
}

/**
 * Prototypes the candidate root by cloning it with an inherited source.
 * @param {MetadataCandidateValues} candidate - Candidate to clone into a shared prototype.
 * @returns {object} Root whose required fields are inherited-only.
 */
function withInheritedRoot(candidate: MetadataCandidateValues): object {
  const source = {
    classAverages: { ...candidate.classAverages },
    recentAssignments: [],
  };
  return Object.create(source);
}

/** One nested metadata level probed against a real required field. */
interface RequiredFieldLevel {
  level: string;
  record: (candidate: MetadataCandidateValues) => object;
  requiredField: string;
}

/** One ownership probe applied to a raw record's required field. */
interface RequiredFieldProbe {
  apply: (record: object, requiredField: string) => void;
  descriptor: string;
}

const REQUIRED_FIELD_LEVELS: RequiredFieldLevel[] = [
  {
    level: 'classAverages',
    record: (candidate) => asScratchPad(candidate).classAverages as object,
    requiredField: 'completeness',
  },
  {
    level: 'recent entry',
    record: (candidate) => candidate.recentAssignments[0],
    requiredField: 'assignmentId',
  },
  {
    level: 'recent entry averages',
    record: (candidate) => candidate.recentAssignments[0].averages,
    requiredField: 'completeness',
  },
];

const REQUIRED_FIELD_PROBES: RequiredFieldProbe[] = [
  {
    apply: (record, requiredField) => {
      delete asScratchPad(record)[requiredField];
    },
    descriptor: 'missing own key',
  },
  {
    apply: (record, requiredField) => {
      asScratchPad(record)[requiredField] = undefined;
    },
    descriptor: 'own undefined value',
  },
  {
    apply: (record, requiredField) => makeFieldInheritedOnly(record, requiredField, false),
    descriptor: 'inherited-only value via ordinary prototype',
  },
  {
    apply: (record, requiredField) => makeFieldInheritedOnly(record, requiredField, true),
    descriptor: 'inherited-only value via null-prototype parent',
  },
  {
    apply: (record, requiredField) => {
      asScratchPad(record)[`${requiredField}-extra`] = true;
    },
    descriptor: 'unexpected extra string key',
  },
];

/**
 * Removes one own field and re-homes its value on the record's prototype chain.
 * @param {object} record - Raw record whose field becomes inherited-only.
 * @param {string} requiredField - Required field moved to the prototype.
 * @param {boolean} isNullPrototypeParent - Whether the prototype parent is itself null-prototyped.
 * @returns {void} Mutates the record in place.
 */
function makeFieldInheritedOnly(
  record: object,
  requiredField: string,
  isNullPrototypeParent: boolean
): void {
  const parent: RecordScratchPad = isNullPrototypeParent ? Object.create(null) : {};
  parent[requiredField] = asScratchPad(record)[requiredField];
  delete asScratchPad(record)[requiredField];
  Object.setPrototypeOf(record, parent);
}

describe('ABClass metadata raw-record ownership', () => {
  it('permits null-prototype records at root, averages, entry and entry-average levels', () => {
    const acceptsNullPrototypeAt: Array<(candidate: MetadataCandidateValues) => unknown> = [
      (candidate) => Object.assign(Object.create(null), candidate),
      (candidate) => {
        return {
          ...candidate,
          classAverages: Object.assign(Object.create(null), candidate.classAverages),
        };
      },
      (candidate) => {
        return {
          ...candidate,
          recentAssignments: [Object.assign(Object.create(null), candidate.recentAssignments[0])],
        };
      },
      (candidate) => {
        return {
          ...candidate,
          recentAssignments: [
            {
              ...candidate.recentAssignments[0],
              averages: Object.assign(Object.create(null), candidate.recentAssignments[0].averages),
            },
          ],
        };
      },
      // Null-prototype roots without own entries are accepted as complete snapshots too.
      (candidate) => Object.assign(Object.create(null), { ...candidate, recentAssignments: [] }),
    ];
    const singleEntry = metadataWithSingleEntry();
    for (const buildNullPrototype of acceptsNullPrototypeAt) {
      const probed = buildNullPrototype(singleEntry);
      expect(isAccepted(probed)).toBe(true);
    }
  });

  it('accepts a null-prototype clone after an extra undefined own key is removed', () => {
    const padded = asScratchPad({ ...metadataCandidate(DEFAULT_CLASS_AVERAGES, []) });
    padded.inherited = undefined;
    const cleaned = asScratchPad(Object.assign(Object.create(null), padded));
    delete cleaned.inherited;
    expect(isAccepted(cleaned)).toBe(true);
  });

  it('rejects inherited-only required fields at the root', () => {
    const singleEntry = metadataWithSingleEntry();
    const inheritedRoot = withInheritedRoot(singleEntry);
    expect(isAccepted(inheritedRoot)).toBe(false);
  });

  it('rejects required-field ownership probes at every nested level', () => {
    for (const { level, record, requiredField } of REQUIRED_FIELD_LEVELS) {
      for (const { apply, descriptor } of REQUIRED_FIELD_PROBES) {
        const candidate = metadataWithSingleEntry();
        apply(record(candidate), requiredField);
        expect(isAccepted(candidate), `${level}: ${descriptor}`).toBe(false);
      }
    }
  });

  it('rejects missing required root fields', () => {
    for (const key of ['classAverages', 'recentAssignments'] as const) {
      const missing = Object.create(null);
      Object.defineProperty(missing, key, {
        value:
          key === 'classAverages'
            ? { ...DEFAULT_SCORES, updatedAt: CANONICAL_METADATA_TIMESTAMP }
            : [],
        enumerable: true,
      });
      expect(isAccepted(missing)).toBe(false);
    }
  });

  it('rejects non-plain root instances such as dates and class instances', () => {
    const dateRoot = Object.assign(new Date(), metadataCandidate(DEFAULT_CLASS_AVERAGES, []));
    expect(isAccepted(dateRoot)).toBe(false);
    const classRoot = Object.assign(
      new (class MetadataInstance {})(),
      metadataCandidate(DEFAULT_CLASS_AVERAGES, [])
    );
    expect(isAccepted(classRoot)).toBe(false);
  });

  it('rejects unexpected own symbol keys on the root', () => {
    const symbolKeyed = withRootSymbolKey(
      metadataCandidate(DEFAULT_CLASS_AVERAGES, []),
      Symbol('unexpected'),
      true
    );
    expect(isAccepted(symbolKeyed)).toBe(false);
  });

  it('rejects unexpected own string keys on nested records', () => {
    for (const key of ['classAverages', 'recentAssignments'] as const) {
      const candidate = metadataCandidate(DEFAULT_CLASS_AVERAGES, []);
      const target =
        key === 'classAverages' ? candidate.classAverages : candidate.recentAssignments;
      asScratchPad(target)[`${key}-extra`] = true;
      expect(isAccepted(candidate)).toBe(false);
    }
  });

  it('rejects non-plain records at every nested level', () => {
    const averagesRoot = metadataWithSingleEntry();
    asScratchPad(averagesRoot).classAverages = Object.assign(new Date(), {
      ...DEFAULT_CLASS_AVERAGES,
      updatedAt: CANONICAL_METADATA_TIMESTAMP,
    });
    expect(isAccepted(averagesRoot)).toBe(false);
    const dateAverages = Object.assign(
      new Date(),
      recentAssignment('a', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES).averages
    );
    const entryInstance = metadataCandidate(DEFAULT_CLASS_AVERAGES, [
      {
        ...recentAssignment('a', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
        averages: dateAverages,
      },
    ]);
    expect(isAccepted(entryInstance)).toBe(false);
  });

  it('rejects nested undefined required-field values', () => {
    for (const field of ['classAverages', 'recentAssignments', 'updatedEntry'] as const) {
      const candidate = metadataCandidate(DEFAULT_CLASS_AVERAGES, [
        recentAssignment('a', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
      ]);
      if (field === 'classAverages') {
        asScratchPad(candidate).classAverages = Object.assign(Object.create(null), {
          ...candidate.classAverages,
          completeness: undefined,
        });
      } else if (field === 'recentAssignments') {
        candidate.recentAssignments[0].averages.completeness = undefined;
      } else {
        asScratchPad(candidate.recentAssignments[0]).updatedAt = undefined;
      }
      expect(isAccepted(candidate)).toBe(false);
    }
  });
});
