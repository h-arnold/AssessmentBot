import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Validate } from '../../src/backend/Utils/Validate.js';

const originalValidate = globalThis.Validate;

beforeAll(() => {
  globalThis.Validate = Validate;
});

afterAll(() => {
  if (originalValidate === undefined) {
    delete globalThis.Validate;
    return;
  }

  globalThis.Validate = originalValidate;
});

async function loadAssignmentTopic() {
  const module = await import('../../src/backend/Models/AssignmentTopic.js');
  return module.AssignmentTopic ?? module.default?.AssignmentTopic;
}

// ─── AssignmentTopic constructor tests ────────────────────────────────────────

describe('AssignmentTopic model - constructor', () => {
  it('AssignmentTopic constructor accepts key, name, yearGroupKeys parameters', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();
    expect(() => {
      new AssignmentTopic('topic-key-001', 'Test Topic', ['yg-001', 'yg-002']);
    }).not.toThrow();
  });

  it('AssignmentTopic constructor throws on missing required params (key, name)', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const invalidParams = [
      { key: null, name: 'Test', yearGroupKeys: [] },
      { key: undefined, name: 'Test', yearGroupKeys: [] },
      { key: '', name: 'Test', yearGroupKeys: [] },
      { key: 'test-key', name: null, yearGroupKeys: [] },
      { key: 'test-key', name: undefined, yearGroupKeys: [] },
      { key: 'test-key', name: '', yearGroupKeys: [] },
    ];

    for (const params of invalidParams) {
      expect(() => {
        new AssignmentTopic(params.key, params.name, params.yearGroupKeys);
      }).toThrow();
    }
  });
});

// ─── AssignmentTopic setter tests ────────────────────────────────────────────

describe('AssignmentTopic model - setters', () => {
  it('setKey accepts valid trimmed non-empty string', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const topic = new AssignmentTopic('initial-key', 'Initial Name', []);
    expect(() => {
      topic.setKey('  new-key-001  ');
    }).not.toThrow();
    expect(topic.getKey()).toBe('new-key-001');
  });

  it('setKey throws on empty/invalid string', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const topic = new AssignmentTopic('initial-key', 'Initial Name', []);

    const invalidKeys = ['', '   ', null, undefined, 123, true, {}, []];

    for (const invalidKey of invalidKeys) {
      expect(() => {
        topic.setKey(invalidKey);
      }).toThrow();
    }
  });

  it('setName accepts valid trimmed non-empty string', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const topic = new AssignmentTopic('test-key', 'Initial Name', []);
    expect(() => {
      topic.setName('  New Topic Name  ');
    }).not.toThrow();
    expect(topic.getName()).toBe('New Topic Name');
  });

  it('setName throws on empty/invalid string', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const topic = new AssignmentTopic('test-key', 'Initial Name', []);

    const invalidNames = ['', '   ', null, undefined, 123, true, {}, []];

    for (const invalidName of invalidNames) {
      expect(() => {
        topic.setName(invalidName);
      }).toThrow();
    }
  });

  it('setYearGroupKeys accepts array of valid trimmed non-empty strings', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const topic = new AssignmentTopic('test-key', 'Test Topic', []);
    expect(() => {
      topic.setYearGroupKeys(['  yg-001  ', 'yg-002', '  yg-003  ']);
    }).not.toThrow();
    expect(topic.getYearGroupKeys()).toEqual(['yg-001', 'yg-002', 'yg-003']);
  });

  it('setYearGroupKeys throws on array with empty/invalid strings', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const topic = new AssignmentTopic('test-key', 'Test Topic', []);

    const invalidYearGroupKeys = [
      ['yg-001', ''],
      ['yg-001', '   '],
      ['yg-001', null],
      ['yg-001', undefined],
      ['', 'yg-001'],
      ['   ', 'yg-001'],
      [123, 'yg-001'],
      [true, 'yg-001'],
    ];

    for (const invalidKeys of invalidYearGroupKeys) {
      expect(() => {
        topic.setYearGroupKeys(invalidKeys);
      }).toThrow();
    }
  });

  it('setYearGroupKeys validates that every element in the array is a trimmed non-empty string, throwing on any invalid element', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const topic = new AssignmentTopic('test-key', 'Test Topic', []);

    // Test with valid array
    expect(() => {
      topic.setYearGroupKeys(['yg-001', 'yg-002']);
    }).not.toThrow();

    // Test with array containing an invalid element at different positions
    const invalidArrays = [
      ['', 'yg-002'],
      ['yg-001', ''],
      ['yg-001', '   ', 'yg-003'],
      [null, 'yg-002'],
      ['yg-001', undefined],
    ];

    for (const invalidArray of invalidArrays) {
      expect(() => {
        topic.setYearGroupKeys(invalidArray);
      }).toThrow();
    }
  });
});

// ─── AssignmentTopic serialization tests ──────────────────────────────────────

describe('AssignmentTopic model - serialization', () => {
  it('toJSON() returns object with key, name, AND yearGroupKeys fields', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const topic = new AssignmentTopic('test-key', 'Test Topic', ['yg-001', 'yg-002']);
    const json = topic.toJSON();

    expect(json).toHaveProperty('key', 'test-key');
    expect(json).toHaveProperty('name', 'Test Topic');
    expect(json).toHaveProperty('yearGroupKeys', ['yg-001', 'yg-002']);
  });

  it('toJSON() returns all three fields in the correct structure', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const topic = new AssignmentTopic('t-key-001', 'Test Topic', ['yg-a', 'yg-b']);
    const json = topic.toJSON();

    expect(Object.keys(json).sort()).toEqual(['key', 'name', 'yearGroupKeys'].sort());
  });
});

// ─── AssignmentTopic deserialization tests ────────────────────────────────────

describe('AssignmentTopic model - deserialization', () => {
  it('fromJSON() creates valid AssignmentTopic instance from JSON with all three fields', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const json = { key: 't-key-001', name: 'Test Topic', yearGroupKeys: ['yg-001', 'yg-002'] };
    const topic = AssignmentTopic.fromJSON(json);

    expect(topic).toBeInstanceOf(AssignmentTopic);
    expect(topic.getKey()).toBe('t-key-001');
    expect(topic.getName()).toBe('Test Topic');
    expect(topic.getYearGroupKeys()).toEqual(['yg-001', 'yg-002']);
  });

  it('fromJSON() successfully loads canonical AssignmentTopic data with explicit yearGroupKeys', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const canonicalJson = {
      key: 'canonical-key',
      name: 'Canonical Topic',
      yearGroupKeys: ['year-group-1', 'year-group-2', 'year-group-3'],
    };
    const topic = AssignmentTopic.fromJSON(canonicalJson);

    expect(topic).toBeInstanceOf(AssignmentTopic);
    expect(topic.getKey()).toBe('canonical-key');
    expect(topic.getName()).toBe('Canonical Topic');
    expect(topic.getYearGroupKeys()).toEqual(['year-group-1', 'year-group-2', 'year-group-3']);
  });

  it('fromJSON() throws when yearGroupKeys is missing', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const incompleteJson = { key: 't-key-002', name: 'Test Topic' };

    expect(() => {
      AssignmentTopic.fromJSON(incompleteJson);
    }).toThrow();
  });

  it('fromJSON() throws on invalid JSON input', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const invalidInputs = [
      null,
      undefined,
      '',
      123,
      true,
      [],
      { key: 'test', name: 123, yearGroupKeys: [] },
      { key: 'test', name: 'Test', yearGroupKeys: 'not-an-array' },
    ];

    for (const invalidInput of invalidInputs) {
      expect(() => {
        AssignmentTopic.fromJSON(invalidInput);
      }).toThrow();
    }
  });
});

// ─── AssignmentTopic round-trip tests ─────────────────────────────────────────

describe('AssignmentTopic model - round-trip', () => {
  it('fromJSON() → toJSON() round-trip preserves all fields', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const originalJson = {
      key: 'round-trip-key',
      name: 'Round Trip Topic',
      yearGroupKeys: ['yg-001', 'yg-002'],
    };

    const topic = AssignmentTopic.fromJSON(originalJson);
    const restoredJson = topic.toJSON();

    expect(restoredJson).toEqual(originalJson);
  });

  it('constructor → toJSON() preserves all fields', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const topic = new AssignmentTopic('ctor-key', 'Constructor Topic', ['yg-a', 'yg-b']);
    const json = topic.toJSON();

    expect(json).toEqual({
      key: 'ctor-key',
      name: 'Constructor Topic',
      yearGroupKeys: ['yg-a', 'yg-b'],
    });
  });
});

// ─── AssignmentTopic getter tests ─────────────────────────────────────────────

describe('AssignmentTopic model - getters', () => {
  it('getKey() returns the key field', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const topic = new AssignmentTopic('getter-key', 'Getter Topic', []);
    expect(topic.getKey()).toBe('getter-key');
  });

  it('getName() returns the name field', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const topic = new AssignmentTopic('getter-key', 'Getter Topic', []);
    expect(topic.getName()).toBe('Getter Topic');
  });

  it('getYearGroupKeys() returns the yearGroupKeys array', async () => {
    const AssignmentTopic = await loadAssignmentTopic();

    // In RED phase, module doesn't exist yet - this test should fail
    expect(AssignmentTopic).not.toBeNull();

    const yearGroupKeys = ['yg-getter-1', 'yg-getter-2'];
    const topic = new AssignmentTopic('getter-key', 'Getter Topic', yearGroupKeys);
    expect(topic.getYearGroupKeys()).toEqual(yearGroupKeys);
  });
});
