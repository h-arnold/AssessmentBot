import { describe, expect, it } from 'vitest';
const AssignmentDefinitionValidation = require('#backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js');

function captureValidationError(validate) {
  let failure;
  try {
    validate();
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(failure).toMatchObject({
    name: 'ApiValidationError',
    code: 'DEFINITION_PARSE_FAILED',
    message:
      'The assignment documents could not be parsed. Check the reference and template documents, then try again.',
  });
}

describe('shared definition artefact availability', () => {
  it.each([
    undefined,
    null,
    { id: 'task-without-artifacts' },
    { id: 'task-null-artifacts', artifacts: null },
  ])('rejects a task with missing internal artefact structure: %o', (task) => {
    const validation = new AssignmentDefinitionValidation();
    let failure;
    try {
      validation.validateSharedArtifacts(task);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toMatchObject({
      name: 'ApiValidationError',
      code: 'DEFINITION_PARSE_FAILED',
    });
  });

  it('propagates a task serializer TypeError unchanged', () => {
    const validation = new AssignmentDefinitionValidation();
    const sentinel = new TypeError('task serializer wiring failed');
    const task = {
      toJSON: () => {
        throw sentinel;
      },
    };

    let failure;
    try {
      validation.validateSharedArtifacts(task);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBe(sentinel);
  });

  it.each([
    { type: 'TEXT', content: '' },
    { type: 'SPREADSHEET', content: [] },
  ])('accepts a valid blank $type template', ({ type, content }) => {
    const validation = new AssignmentDefinitionValidation();
    expect(
      validation.validateSharedArtifacts({
        id: 'task-blank',
        taskTitle: 'Blank task',
        pageId: 'page-blank',
        artifacts: {
          reference: [],
          template: [{ type, role: 'template', content, contentHash: 'hash-empty' }],
        },
      })
    ).toBe(true);
  });

  it.each([
    { type: 'TEXT', content: null, contentHash: 'hash' },
    { type: 'TEXT', content: 'usable', contentHash: null },
    { type: 'SPREADSHEET', content: null, contentHash: 'hash' },
    { type: 'SPREADSHEET', content: [], contentHash: null },
    { type: 'TEXT', content: 'usable', contentHash: 42 },
  ])('rejects unavailable non-IMAGE shared artefact content or hash: %o', (artifact) => {
    const validation = new AssignmentDefinitionValidation();
    captureValidationError(() =>
      validation.validateSharedArtifacts({
        id: 'task-unavailable',
        taskTitle: 'Unavailable',
        pageId: 'page-unavailable',
        artifacts: {
          reference: [{ ...artifact, role: 'reference', taskId: 'task-unavailable' }],
          template: [],
        },
      })
    );
  });

  it('allows pending IMAGE content and hash in definition-store state', () => {
    const validation = new AssignmentDefinitionValidation();
    expect(
      validation.validateSharedArtifacts({
        id: 'task-image',
        taskTitle: 'Image',
        pageId: 'page-image',
        artifacts: {
          reference: [{ type: 'IMAGE', role: 'reference', content: null, contentHash: null }],
          template: [],
        },
      })
    ).toBe(true);
  });
});
