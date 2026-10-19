import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';
import { validateClassMetadata } from '#synthetic-data/validateClassMetadata.js';
import { validateSyntheticAnalysisGraph } from '#synthetic-data/validateSyntheticAnalysisGraph.js';

type RawRecord = Record<PropertyKey, any>;
type RawGraph = {
  persistence: { classes: Array<{ classId: string; metadata?: any }> };
  transport: {
    classPartials: Array<{ classId: string; metadata?: any }>;
    classesById: Record<string, { metadata?: any }>;
  };
  [key: string]: any;
};

const RECORD_PATHS = [
  'metadata',
  'classAverages',
  'recentAssignments[0]',
  'recentAssignments[0].averages',
] as const;

function makeGraph(): RawGraph {
  const graph = structuredClone(generateSyntheticAnalysisGraph('medium')) as RawGraph;
  const metadata = graph.persistence.classes[0].metadata as RawRecord;
  if (metadata === null) throw new Error('Expected medium class zero to contain metadata.');
  return graph;
}

function metadataAt(graph: RawGraph, path: (typeof RECORD_PATHS)[number]): RawRecord {
  const metadata = graph.persistence.classes[0].metadata as RawRecord;
  if (path === 'metadata') return metadata;
  if (path === 'classAverages') return metadata.classAverages;
  if (path === 'recentAssignments[0]') return metadata.recentAssignments[0];
  return metadata.recentAssignments[0].averages;
}

function synchroniseMetadataViews(graph: RawGraph): void {
  const classDocument = graph.persistence.classes[0];
  const partial = graph.transport.classPartials.find(
    ({ classId }) => classId === classDocument.classId
  );
  if (!partial) throw new Error('Expected canonical partial class view.');
  partial.metadata = classDocument.metadata;
  graph.transport.classesById[classDocument.classId].metadata = classDocument.metadata;
}

function checkBothValidators(graph: RawGraph, message: RegExp): void {
  expect.soft(() => validateClassMetadata(graph)).toThrow(message);
  expect.soft(() => validateSyntheticAnalysisGraph(graph)).toThrow(message);
}

function addExtra(record: RawRecord, kind: 'enumerable' | 'hidden' | 'symbol'): void {
  const key = kind === 'symbol' ? Symbol('unexpected') : 'unexpected';
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: kind !== 'hidden',
    value: true,
  });
}

describe('generator-owned strict raw metadata shape', () => {
  it.each(RECORD_PATHS)('accepts ordinary and null-prototype records at %s', (path) => {
    for (const prototype of [Object.prototype, null]) {
      const graph = makeGraph();
      const record = metadataAt(graph, path);
      Object.setPrototypeOf(record, prototype);
      synchroniseMetadataViews(graph);
      expect(() => validateClassMetadata(graph)).not.toThrow();
      expect(() => validateSyntheticAnalysisGraph(graph)).not.toThrow();
    }
  });

  it.each(RECORD_PATHS)('rejects custom-prototype records at %s', (path) => {
    const graph = makeGraph();
    Object.setPrototypeOf(metadataAt(graph, path), { inheritedField: true });
    synchroniseMetadataViews(graph);
    checkBothValidators(graph, /plain record|ordinary object|is required/iu);
  });

  it.each(RECORD_PATHS)('rejects class instances at %s', (path) => {
    const graph = makeGraph();
    const source = metadataAt(graph, path);
    const instance = Object.assign(new (class MetadataRecord {})(), source);
    const classDocument = graph.persistence.classes[0];
    if (path === 'metadata') {
      classDocument.metadata = instance;
    } else if (path === 'classAverages') {
      (classDocument.metadata as RawRecord).classAverages = instance;
    } else if (path === 'recentAssignments[0]') {
      (classDocument.metadata as RawRecord).recentAssignments[0] = instance;
    } else {
      (classDocument.metadata as RawRecord).recentAssignments[0].averages = instance;
    }
    synchroniseMetadataViews(graph);
    checkBothValidators(graph, /plain record|ordinary object/iu);
  });

  it.each(RECORD_PATHS)(
    'rejects Date instances where a metadata record is required at %s',
    (path) => {
      const graph = makeGraph();
      const classDocument = graph.persistence.classes[0];
      const root = classDocument.metadata as RawRecord;
      if (path === 'metadata') {
        classDocument.metadata = new Date('2026-10-16T00:00:00.000Z') as any;
      } else {
        const parent =
          path === 'classAverages'
            ? root
            : path === 'recentAssignments[0]'
              ? root.recentAssignments
              : root.recentAssignments[0];
        const key =
          path === 'classAverages'
            ? 'classAverages'
            : path === 'recentAssignments[0]'
              ? 0
              : 'averages';
        parent[key] = new Date('2026-10-16T00:00:00.000Z');
      }
      synchroniseMetadataViews(graph);
      checkBothValidators(graph, /plain record|ordinary object|is required|live Date/iu);
    }
  );

  it.each(
    RECORD_PATHS.flatMap((path) =>
      (['enumerable', 'hidden', 'symbol'] as const).map((kind) => ({ path, kind }))
    )
  )('rejects $kind unexpected own keys at $path', ({ path, kind }) => {
    const graph = makeGraph();
    addExtra(metadataAt(graph, path), kind);
    synchroniseMetadataViews(graph);
    checkBothValidators(graph, /unexpected|own field|extra field/iu);
  });

  it.each(RECORD_PATHS)('requires own contract fields at %s', (path) => {
    const graph = makeGraph();
    const record = metadataAt(graph, path);
    const required =
      path === 'metadata'
        ? 'classAverages'
        : path === 'classAverages'
          ? 'completeness'
          : path === 'recentAssignments[0]'
            ? 'assignmentId'
            : 'overall';
    const inherited = record[required];
    delete record[required];
    Object.setPrototypeOf(record, { [required]: inherited });
    synchroniseMetadataViews(graph);
    const recordPath = path.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const fieldPath = `${recordPath}\\.${required}`;
    checkBothValidators(
      graph,
      new RegExp(
        `(?:${recordPath}.*(?:plain record|ordinary object|must be an object)|${fieldPath}.*required)`,
        'iu'
      )
    );
  });

  it('rejects an inherited sparse index even when an extra own array key balances key density', () => {
    const graph = makeGraph();
    const entries = (graph.persistence.classes[0].metadata as RawRecord).recentAssignments;
    const missing = entries[1];
    delete entries[1];
    const inheritedIndices = Object.create(Array.prototype);
    Object.defineProperty(inheritedIndices, '1', { value: missing });
    Object.setPrototypeOf(entries, inheritedIndices);
    Object.defineProperty(entries, 'extra', { enumerable: true, value: true });
    synchroniseMetadataViews(graph);
    checkBothValidators(graph, /dense|sparse|own array|unexpected array/iu);
  });

  it('rejects an inherited hole without any extra enumerable key', () => {
    const graph = makeGraph();
    const entries = (graph.persistence.classes[0].metadata as RawRecord).recentAssignments;
    const inherited = entries[0];
    delete entries[0];
    const inheritedIndices = Object.create(Array.prototype);
    Object.defineProperty(inheritedIndices, '0', { value: inherited });
    Object.setPrototypeOf(entries, inheritedIndices);
    synchroniseMetadataViews(graph);
    checkBothValidators(graph, /dense|sparse|own array/iu);
  });

  it.each(['hidden', 'symbol'] as const)('rejects %s extra own array properties', (kind) => {
    const graph = makeGraph();
    const entries = (graph.persistence.classes[0].metadata as RawRecord).recentAssignments;
    addExtra(entries, kind);
    synchroniseMetadataViews(graph);
    checkBothValidators(graph, /array.*(extra|unexpected|own)|unexpected array/iu);
  });

  it('accepts a dense Array subclass as recentAssignments', () => {
    const graph = makeGraph();
    const metadata = graph.persistence.classes[0].metadata as RawRecord;
    metadata.recentAssignments = Object.assign([], metadata.recentAssignments);
    Object.setPrototypeOf(metadata.recentAssignments, class Entries extends Array {}.prototype);
    synchroniseMetadataViews(graph);
    expect(() => validateClassMetadata(graph)).not.toThrow();
    expect(() => validateSyntheticAnalysisGraph(graph)).not.toThrow();
    expect(() => (globalThis as any).ABClassMetadata.validateMetadata(metadata)).not.toThrow();
  });

  it.each(['Date', 'class instance'] as const)('rejects a %s as a metadata record', (kind) => {
    const graph = makeGraph();
    const replacement = kind === 'Date' ? new Date('2026-10-16T00:00:00.000Z') : new (class {})();
    graph.persistence.classes[0].metadata = replacement as any;
    synchroniseMetadataViews(graph);
    checkBothValidators(graph, /plain record|ordinary object|is required|live Date/iu);
  });
});
