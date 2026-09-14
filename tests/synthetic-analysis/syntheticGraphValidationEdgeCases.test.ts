import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import { assertSerialisable } from '../../scripts/synthetic-test-data/invariantGuards.js';
import { validateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/validateSyntheticAnalysisGraph.js';
import { assertYearGroupDistribution } from '../../scripts/synthetic-test-data/validateProfileInvariants.js';
import { buildValidationContext } from '../../scripts/synthetic-test-data/validationContext.js';
import type { AssignmentDefinitionPartial } from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassFull } from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassPartial } from '../../src/frontend/src/services/googleClassrooms/classPartials.zod';

/**
 * Generator-internal observation of a persistence class document.
 */
type GeneratedClassDocument = {
  classId: string;
  yearGroupKey: string;
  students: Array<{ id: string }>;
};

/**
 * Generator-internal observation of a persistence assignment definition.
 */
type GeneratedDefinitionDocument = {
  definitionKey: string;
  tasks: Record<string, unknown> | Array<{ taskId: string }>;
};

/**
 * Generator-internal observation of a persistence assignment record.
 */
type GeneratedAssignmentRecord = {
  courseId: string;
  assignmentId: string;
  assignmentDefinitionKey: string;
  submissions: Array<{ studentId: string; assignmentId: string }>;
};

/**
 * Mutable observation of the generated graph used to build corrupted fixtures.
 * Transport views are typed against the real frontend service contracts;
 * reference and persistence views are observations where no frontend schema applies.
 */
type MutableGraph = {
  manifest: { generatedEntityCounts: Record<string, number> };
  referenceData: {
    cohorts: unknown[];
    yearGroups: Array<{ key: string }>;
    assignmentTopics: unknown[];
  };
  persistence: {
    classes: GeneratedClassDocument[];
    assignmentDefinitions: GeneratedDefinitionDocument[];
    assignments: GeneratedAssignmentRecord[];
  };
  transport: {
    classPartials: ClassPartial[];
    assignmentDefinitionPartials: AssignmentDefinitionPartial[];
    classesById: Record<string, ClassFull>;
    assignmentsByKey: Record<string, unknown>;
  };
};

const SMALL_PROFILE = 'small';

/** Manifest entity counts the generator always emits for every profile. */
const REQUIRED_ENTITY_COUNTS = [
  'classes',
  'students',
  'assignments',
  'assignmentDefinitions',
  'cohorts',
  'yearGroups',
  'assignmentTopics',
] as const;

/**
 * Creates a fresh, locally mutable copy of the generated small-profile graph.
 *
 * @returns A mutable copy of the small-profile logical graph.
 */
function createMutableGraph(): MutableGraph {
  return structuredClone(generateSyntheticAnalysisGraph(SMALL_PROFILE)) as MutableGraph;
}

/**
 * Returns the first class identifier present in the class transport view.
 *
 * @param graph The mutable graph under test.
 * @returns The first class identifier.
 */
function firstClassId(graph: MutableGraph): string {
  const classId = Object.keys(graph.transport.classesById)[0];
  if (classId === undefined) {
    throw new Error('Expected at least one generated class');
  }
  return classId;
}

describe('synthetic manifest required entity counts', () => {
  it.each(REQUIRED_ENTITY_COUNTS)(
    'rejects a manifest that omits the required %s count',
    (entityName) => {
      const graph = createMutableGraph();
      delete graph.manifest.generatedEntityCounts[entityName];

      expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(entityName);
    }
  );
});

describe('synthetic Year Group distribution invariant', () => {
  it('rejects a profile with fewer classes than Year Groups', () => {
    const classes = [
      { classId: 'class-0', yearGroupKey: 'year-7' },
      { classId: 'class-1', yearGroupKey: 'year-8' },
    ];
    const yearGroups = [
      { key: 'year-7' },
      { key: 'year-8' },
      { key: 'year-9' },
      { key: 'year-10' },
    ];

    expect(() => assertYearGroupDistribution({ classes, yearGroups })).toThrow(/Year Group/u);
  });

  it('accepts a balanced distribution where every Year Group holds one class', () => {
    const classes = [
      { classId: 'class-0', yearGroupKey: 'year-7' },
      { classId: 'class-1', yearGroupKey: 'year-8' },
      { classId: 'class-2', yearGroupKey: 'year-9' },
      { classId: 'class-3', yearGroupKey: 'year-10' },
    ];
    const yearGroups = [
      { key: 'year-7' },
      { key: 'year-8' },
      { key: 'year-9' },
      { key: 'year-10' },
    ];

    expect(() => assertYearGroupDistribution({ classes, yearGroups })).not.toThrow();
  });
});

/**
 * A required graph-container corruption used to prove the validator reports an
 * actionable invariant failure rather than a native dereference error.
 */
type MalformedGraphCase = {
  readonly label: string;
  readonly offendingPath: string;
  readonly corrupt: (graph: MutableGraph) => void;
};

const MALFORMED_GRAPH_CASES: MalformedGraphCase[] = [
  {
    label: 'missing manifest',
    offendingPath: 'manifest',
    corrupt: (graph) => {
      Reflect.deleteProperty(graph, 'manifest');
    },
  },
  {
    label: 'missing referenceData',
    offendingPath: 'referenceData',
    corrupt: (graph) => {
      Reflect.deleteProperty(graph, 'referenceData');
    },
  },
  {
    label: 'missing persistence',
    offendingPath: 'persistence',
    corrupt: (graph) => {
      Reflect.deleteProperty(graph, 'persistence');
    },
  },
  {
    label: 'null manifest entity-count record',
    offendingPath: 'generatedEntityCounts',
    corrupt: (graph) => {
      (graph.manifest as { generatedEntityCounts: unknown }).generatedEntityCounts = null;
    },
  },
  {
    label: 'null reference-data cohort list',
    offendingPath: 'cohorts',
    corrupt: (graph) => {
      (graph.referenceData as { cohorts: unknown }).cohorts = null;
    },
  },
  {
    label: 'null reference-data Year Group list',
    offendingPath: 'yearGroups',
    corrupt: (graph) => {
      (graph.referenceData as { yearGroups: unknown }).yearGroups = null;
    },
  },
  {
    label: 'null reference-data assignment-topic list',
    offendingPath: 'assignmentTopics',
    corrupt: (graph) => {
      (graph.referenceData as { assignmentTopics: unknown }).assignmentTopics = null;
    },
  },
  {
    label: 'null persistence class list',
    offendingPath: 'classes',
    corrupt: (graph) => {
      (graph.persistence as { classes: unknown }).classes = null;
    },
  },
  {
    label: 'null persistence definition list',
    offendingPath: 'assignmentDefinitions',
    corrupt: (graph) => {
      (graph.persistence as { assignmentDefinitions: unknown }).assignmentDefinitions = null;
    },
  },
  {
    label: 'null persistence assignment list',
    offendingPath: 'assignments',
    corrupt: (graph) => {
      (graph.persistence as { assignments: unknown }).assignments = null;
    },
  },
];

describe('synthetic graph required container validation', () => {
  it.each(MALFORMED_GRAPH_CASES)(
    'reports an actionable invariant failure for $label',
    ({ corrupt, offendingPath }) => {
      const graph = createMutableGraph();
      corrupt(graph);

      let message = '';
      try {
        validateSyntheticAnalysisGraph(graph);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toMatch(/^Synthetic analysis graph invariant failed:/u);
      expect(message).toContain(offendingPath);
    }
  );
});

describe('synthetic transport assignment-definition uniqueness', () => {
  it('rejects duplicate assignment-definition records in the transport view', () => {
    const graph = createMutableGraph();
    graph.transport.assignmentDefinitionPartials.push(
      structuredClone(graph.transport.assignmentDefinitionPartials[0])
    );

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/duplicate/u);
  });
});

describe('synthetic transport and persistence roster agreement', () => {
  it('rejects a same-sized transport class roster that differs from persistence', () => {
    const graph = createMutableGraph();
    const classId = firstClassId(graph);
    const classFull = graph.transport.classesById[classId];
    const persistenceClass = graph.persistence.classes.find(
      (candidate) => candidate.classId === classId
    );
    if (persistenceClass === undefined) {
      throw new Error('Expected a persistence class for the transport class');
    }

    // The class transport view shares its roster objects with the persistence
    // class, so replace the roster with fresh objects instead of mutating the
    // shared ones; only the transport roster is meant to diverge here.
    const originalRosterIds = classFull.students.map((student) => student.id);
    classFull.students = classFull.students.map((student, index) => ({
      ...student,
      id: `transport-student-${index}`,
    }));
    const renamedStudentIds = new Map(
      originalRosterIds.map((originalId, index) => [originalId, `transport-student-${index}`])
    );

    for (const assignment of classFull.assignments) {
      for (const submission of assignment.submissions) {
        const replacementId = renamedStudentIds.get(submission.studentId);
        if (replacementId !== undefined) {
          submission.studentId = replacementId;
        }
      }
    }

    expect(renamedStudentIds.size).toBe(persistenceClass.students.length);
    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/roster/u);
  });
});

describe('synthetic persistence identity uniqueness', () => {
  it('rejects duplicate persistence assignment-definition keys', () => {
    const graph = createMutableGraph();
    graph.persistence.assignmentDefinitions.push(
      structuredClone(graph.persistence.assignmentDefinitions[0])
    );
    graph.manifest.generatedEntityCounts.assignmentDefinitions += 1;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/duplicate/u);
  });

  it('rejects duplicate persistence assignment IDs', () => {
    const graph = createMutableGraph();
    const assignmentWithSubmissions = graph.persistence.assignments.find(
      (candidate) => candidate.submissions.length > 0
    );
    if (assignmentWithSubmissions === undefined) {
      throw new Error('Expected a persistence assignment with submissions');
    }
    graph.persistence.assignments.push(structuredClone(assignmentWithSubmissions));

    expect(() =>
      buildValidationContext(graph.manifest, graph.referenceData, graph.persistence)
    ).toThrow(/duplicate/u);
  });

  it('rejects a duplicate assignment ID that would hide an ownership change', () => {
    const graph = createMutableGraph();
    const assignmentWithSubmissions = graph.persistence.assignments.find(
      (candidate) => candidate.submissions.length > 0
    );
    if (assignmentWithSubmissions === undefined) {
      throw new Error('Expected a persistence assignment with submissions');
    }
    const differentOwner = graph.persistence.classes.find(
      (candidate) => candidate.classId !== assignmentWithSubmissions.courseId
    );
    if (differentOwner === undefined) {
      throw new Error('Expected a second persistence class to move the duplicate onto');
    }

    const duplicate = structuredClone(assignmentWithSubmissions);
    duplicate.courseId = differentOwner.classId;
    graph.persistence.assignments.push(duplicate);

    expect(() =>
      buildValidationContext(graph.manifest, graph.referenceData, graph.persistence)
    ).toThrow(/duplicate/u);
  });
});

describe('synthetic serialisability of non-finite numbers', () => {
  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('rejects the non-finite number %s', (_label, value) => {
    expect(() => assertSerialisable(value, 'graph.value')).toThrow(/finite/u);
  });

  it('accepts a finite number', () => {
    expect(() => assertSerialisable(42, 'graph.value')).not.toThrow();
  });

  it('rejects a non-finite number embedded in the generated graph', () => {
    const graph = createMutableGraph();
    graph.transport.classesById[firstClassId(graph)].courseLength = Number.NaN;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/finite/u);
  });
});

describe('synthetic transport class assignment uniqueness', () => {
  it('rejects duplicate assignment identifiers within a single transport class', () => {
    const graph = createMutableGraph();
    const classFull = graph.transport.classesById[firstClassId(graph)];
    expect(classFull.assignments.length).toBeGreaterThanOrEqual(2);
    classFull.assignments[1] = structuredClone(classFull.assignments[0]);

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/duplicate/u);
  });
});
