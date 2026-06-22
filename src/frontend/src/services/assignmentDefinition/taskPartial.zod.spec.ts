import { describe, expect, it } from 'vitest';

/**
 * Loads the TaskPartialSchema module under test.
 *
 * @returns {Promise<{ TaskPartialSchema: { parse: (input: unknown) => unknown } }>}
 * The imported schema module.
 */
async function loadTaskPartialSchema(): Promise<{
  TaskPartialSchema: { parse: (input: unknown) => unknown };
}> {
  return import('./taskPartial.zod');
}

describe('TaskPartialSchema', () => {
  it('accepts a valid task partial with id and taskWeighting', async () => {
    const { TaskPartialSchema } = await loadTaskPartialSchema();

    const result = TaskPartialSchema.parse({ id: 't_abc123', taskWeighting: 2 });

    expect(result).toEqual({ id: 't_abc123', taskWeighting: 2 });
  });

  it('rejects extra fields (strict schema)', async () => {
    const { TaskPartialSchema } = await loadTaskPartialSchema();

    expect(() =>
      TaskPartialSchema.parse({ id: 't_abc123', taskWeighting: 2, taskTitle: 'Extra' })
    ).toThrow();
  });

  it('rejects missing required fields', async () => {
    const { TaskPartialSchema } = await loadTaskPartialSchema();

    expect(() => TaskPartialSchema.parse({ id: 't_abc123' })).toThrow();
    expect(() => TaskPartialSchema.parse({ taskWeighting: 2 })).toThrow();
    expect(() => TaskPartialSchema.parse({})).toThrow();
  });

  it('rejects non-numeric taskWeighting', async () => {
    const { TaskPartialSchema } = await loadTaskPartialSchema();

    expect(() => TaskPartialSchema.parse({ id: 't_abc123', taskWeighting: 'two' })).toThrow();
  });

  it('rejects empty string id', async () => {
    const { TaskPartialSchema } = await loadTaskPartialSchema();

    expect(() => TaskPartialSchema.parse({ id: '', taskWeighting: 2 })).toThrow();
  });
});
