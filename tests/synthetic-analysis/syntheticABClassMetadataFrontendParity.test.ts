import { describe, expect, it } from 'vitest';
import { ABClassMetadata } from '#backend/Models/ABClassMetadata.js';
import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';
import { ABClassMetadataSchema } from '@/services/abClass/abClassMetadata.zod';

type Snapshot = { classId: string; metadata: unknown };
type Graph = {
  persistence: { classes: Snapshot[] };
  transport: { classPartials: Snapshot[]; classesById: Record<string, Snapshot> };
};

/** Raw metadata record whose field values are deliberately loose probes. */
type MetadataRecord = Record<string, unknown>;

/** Valid raw metadata carrying records with plain prototypes. */
interface StrictProbe {
  classAverages: MetadataRecord;
  recentAssignments: unknown[];
}

/** Metadata node mutated by the strict raw-object probe matrix. */
type ProbeNode = 'root' | 'classAverages' | 'entry' | 'averages';

/** Names of the required-field ownership probes carried into Node parity. */
const REQUIRED_FIELD_PROBES = [
  'missing own key',
  'own undefined value',
  'inherited only',
  'unexpected extra key',
] as const;

/** Real required key probed at every metadata node level. */
const REQUIRED_FIELD_NODES: Array<{ field: string; node: ProbeNode }> = [
  { field: 'classAverages', node: 'root' },
  { field: 'completeness', node: 'classAverages' },
  { field: 'assignmentId', node: 'entry' },
  { field: 'completeness', node: 'averages' },
];

/** Raw recent-assignment probe entry carrying nested raw averages. */
interface ProbeEntry extends MetadataRecord {
  averages: MetadataRecord;
}

const SUPPORTED_PROFILES = ['small', 'medium', 'large-representative'] as const;
const CANONICAL_TIMESTAMP = '2026-10-19T09:33:28.588Z';
const LATER_TIMESTAMP = '2026-10-20T09:33:28.588Z';
const OLDER_TIMESTAMP = '2026-10-18T09:33:28.588Z';

const VALID_METADATA: StrictProbe = {
  classAverages: {
    completeness: 0,
    accuracy: 1.25,
    spag: 'E',
    overall: 'excluded',
    updatedAt: CANONICAL_TIMESTAMP,
  },
  recentAssignments: [],
};

describe('frontend ABClass metadata schema parity with backend domain validation', () => {
  it.each(SUPPORTED_PROFILES)(
    'preserves acceptance and values for canonical %s snapshots',
    (profile) => {
      const graph = generateSyntheticAnalysisGraph(profile) as Graph;
      const snapshots = [
        ...graph.persistence.classes,
        ...graph.transport.classPartials,
        ...Object.values(graph.transport.classesById),
      ];
      for (const { metadata } of snapshots) {
        expect(() => ABClassMetadata.validateMetadata(metadata)).not.toThrow();
        expect(ABClassMetadataSchema.parse(metadata)).toEqual(metadata);
      }
    }
  );

  it('agrees with backend acceptance for strict raw-object probes', () => {
    const symbolKey = { ...VALID_METADATA, [Symbol('extra')]: true };
    const extraArrayProperty = {
      ...VALID_METADATA,
      recentAssignments: Object.assign([], { extra: true }),
    };
    const extraNested = structuredClone(VALID_METADATA);
    extraNested.classAverages.unexpected = true;
    const inherited = Object.create({ ...VALID_METADATA });
    const classInstance = Object.assign(new (class MetadataRecord {})(), VALID_METADATA);
    const badPrototype = Object.assign(Object.create({}), VALID_METADATA);
    const cases: unknown[] = [
      null,
      VALID_METADATA,
      Object.assign(Object.create(null), VALID_METADATA),
      {
        ...VALID_METADATA,
        classAverages: Object.assign(Object.create(null), VALID_METADATA.classAverages),
      },
      {
        ...VALID_METADATA,
        recentAssignments: [Object.assign(Object.create(null), entry('a', CANONICAL_TIMESTAMP))],
      },
      {
        ...VALID_METADATA,
        recentAssignments: [
          Object.assign(Object.create(null), {
            ...entry('a', CANONICAL_TIMESTAMP),
            averages: Object.assign(Object.create(null), entry('a', CANONICAL_TIMESTAMP).averages),
          }),
        ],
      },
      symbolKey,
      extraArrayProperty,
      new Date(),
      extraNested,
      inherited,
      classInstance,
      badPrototype,
      { ...VALID_METADATA, recentAssignments: Array(1) },
      { ...VALID_METADATA, recentAssignments: Object.assign([], { [Symbol('extra')]: true }) },
      ...(['root', 'classAverages', 'entry', 'averages'] as const).flatMap((node) => [
        mutateNode(VALID_METADATA, node, (record) => Object.create(record)),
        mutateNode(VALID_METADATA, node, (record) =>
          Object.assign(new (class RecordInstance {})(), record)
        ),
        mutateNode(VALID_METADATA, node, (record) => Object.assign(new Date(), record)),
        mutateNode(VALID_METADATA, node, (record) => ({ ...record, [Symbol('extra')]: true })),
      ]),
      {
        ...VALID_METADATA,
        recentAssignments: [entry('a', CANONICAL_TIMESTAMP), entry('a', CANONICAL_TIMESTAMP)],
      },
      {
        ...VALID_METADATA,
        recentAssignments: [entry('a', CANONICAL_TIMESTAMP), entry('b', LATER_TIMESTAMP)],
      },
    ];
    for (const candidate of cases) {
      expectParity(candidate);
    }
  });

  it('agrees with backend rejection for required-field ownership probes at every node', () => {
    for (const { node, field } of REQUIRED_FIELD_NODES) {
      for (const probe of REQUIRED_FIELD_PROBES) {
        const candidate = mutateNode(VALID_METADATA, node, requiredFieldMutation(probe, field));
        expectParity(candidate, false);
      }
    }
  });

  it('compares marker, numeric, identifier, ordering and canonical-date boundaries with backend', () => {
    const dateCases: Array<{ value: string; accepted: boolean }> = [
      { value: '2000-02-29T00:00:00.000Z', accepted: true },
      { value: '1900-02-29T00:00:00.000Z', accepted: false },
      { value: '2004-02-29T00:00:00.000Z', accepted: true },
      { value: '2001-02-29T00:00:00.000Z', accepted: false },
      { value: '0001-01-01T00:00:00.000Z', accepted: true },
      { value: '9999-12-31T23:59:59.999Z', accepted: true },
      { value: '2026-02-30T09:33:28.588Z', accepted: false },
      { value: '2026-10-19T09:33:28+00:00', accepted: false },
      { value: '2026-10-19T09:33:28.58Z', accepted: false },
    ];
    for (const { value, accepted } of dateCases) {
      for (const candidate of [
        { ...VALID_METADATA, classAverages: { ...VALID_METADATA.classAverages, updatedAt: value } },
        { ...VALID_METADATA, recentAssignments: [entry('a', value)] },
      ]) {
        expectParity(candidate, accepted);
      }
    }
    const cases: unknown[] = [
      VALID_METADATA,
      ...[-0.1, 5.1, NaN, Infinity, -Infinity, '2', null, 'n'].map((score) => ({
        ...VALID_METADATA,
        classAverages: { ...VALID_METADATA.classAverages, completeness: score },
      })),
      ...['', ' a', 'a '].map((value) => ({
        ...VALID_METADATA,
        recentAssignments: [{ ...entry(value, CANONICAL_TIMESTAMP), assignmentId: value }],
      })),
      {
        ...VALID_METADATA,
        recentAssignments: [entry('a', CANONICAL_TIMESTAMP), entry('b', OLDER_TIMESTAMP)],
      },
      {
        ...VALID_METADATA,
        recentAssignments: [
          entry('a', CANONICAL_TIMESTAMP),
          entry('b', CANONICAL_TIMESTAMP),
          entry('c', CANONICAL_TIMESTAMP),
          entry('d', CANONICAL_TIMESTAMP),
        ],
      },
    ];
    for (const candidate of cases) expectParity(candidate);
  });
});

/**
 * Asserts backend and frontend acceptance agree for one raw candidate.
 * @param {unknown} candidate - Raw metadata candidate.
 * @param {boolean | undefined} expected - Optional expected acceptance on both sides.
 * @returns {void} Records failing assertions.
 */
function expectParity(candidate: unknown, expected?: boolean): void {
  let backendAccepts = true;
  try {
    ABClassMetadata.validateMetadata(candidate);
  } catch {
    backendAccepts = false;
  }
  const frontendAccepts = ABClassMetadataSchema.safeParse(candidate).success;
  expect(frontendAccepts).toBe(backendAccepts);
  if (expected !== undefined) expect(frontendAccepts).toBe(expected);
}

/**
 * Rebuilds one metadata node of a fresh candidate through a mutation probe.
 * @param {StrictProbe} valid - Canonical valid metadata seeded into the candidate.
 * @param {ProbeNode} node - Metadata node the mutation should replace.
 * @param {function} mutate - Mutation applied to the record-shaped node.
 * @returns {unknown} Candidate carrying one mutated node on a pristine copy.
 */
function mutateNode(
  valid: StrictProbe,
  node: ProbeNode,
  mutate: (record: MetadataRecord) => unknown
): unknown {
  const candidate = structuredClone(valid);
  const seededEntry = entry('a', CANONICAL_TIMESTAMP);
  candidate.recentAssignments = [seededEntry];
  if (node === 'root') return mutate(candidate as unknown as MetadataRecord);
  if (node === 'classAverages') {
    candidate.classAverages = mutate(candidate.classAverages) as MetadataRecord;
    return candidate;
  }
  if (node === 'entry') {
    candidate.recentAssignments = [mutate(seededEntry)];
    return candidate;
  }
  candidate.recentAssignments = [{ ...seededEntry, averages: mutate(seededEntry.averages) }];
  return candidate;
}

/**
 * Builds one canonical raw recent-assignment probe entry.
 * @param {string} assignmentId - Assignment identifier for the entry.
 * @param {string} updatedAt - Assignment timestamp the schema should judge.
 * @returns {MetadataRecord} Raw recent-assignment entry.
 */
function entry(assignmentId: string, updatedAt: string): ProbeEntry {
  return {
    assignmentId,
    assignmentDefinitionKey: 'reused-definition',
    averages: { completeness: 0, accuracy: 'N', spag: 'E', overall: 'excluded' },
    updatedAt,
  };
}

/**
 * Builds one required-field ownership mutation targeting the real required key.
 * @param {(typeof REQUIRED_FIELD_PROBES)[number]} probe - Ownership probe name.
 * @param {string} field - Actual required field probed at the node.
 * @returns {function} Mutation applied to the node's raw record.
 */
function requiredFieldMutation(
  probe: (typeof REQUIRED_FIELD_PROBES)[number],
  field: string
): (record: MetadataRecord) => unknown {
  if (probe === 'missing own key') {
    return (record) => {
      const copy = { ...record };
      delete copy[field];
      return copy;
    };
  }
  if (probe === 'own undefined value') {
    return (record) => ({ ...record, [field]: undefined });
  }
  if (probe === 'unexpected extra key') {
    return (record) => ({ ...record, [`${field}-extra`]: true });
  }
  return (record) => {
    const parent: MetadataRecord = Object.create(null);
    parent[field] = record[field];
    const inherited = Object.assign(Object.create(parent), record);
    delete inherited[field];
    return inherited;
  };
}
