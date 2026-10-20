import { describe, expect, it } from 'vitest';

import { generateClassMetadata } from '#synthetic-data/generateClassMetadata.js';

describe('class metadata matrix invariants', () => {
  it('rejects a compact class index without a configured matrix entry', () => {
    const classIds = Array.from({ length: 4 }, (_, index) => `class-${index}`);
    const classes = Array.from({ length: 4 }, (_, index) => ({
      classId: classIds[index],
      metadata: undefined as unknown,
    }));
    const assignments = classIds.slice(0, 3).map((courseId) => ({
      courseId,
      assignmentId: `${courseId}-assignment`,
      assignmentDefinitionKey: `${courseId}-definition`,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));

    expect(() =>
      generateClassMetadata({
        profileDefinition: { name: 'small' },
        classes,
        assignments,
      })
    ).toThrow(/compact.*matrix.*small.*index 3|small.*matrix.*index 3/iu);
  });

  it('preserves a configured null compact matrix entry', () => {
    const classDocument: { classId: string; metadata?: unknown } = { classId: 'class-0' };
    generateClassMetadata({
      profileDefinition: { name: 'small' },
      classes: [classDocument],
      assignments: [],
    });

    expect(classDocument.metadata).toBeNull();
  });
});
