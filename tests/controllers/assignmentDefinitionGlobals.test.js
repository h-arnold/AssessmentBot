import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { Validate } from '../../src/AdminSheet/Utils/Validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const globalsPath = path.resolve(__dirname, '../../src/AdminSheet/y_controllers/globals.js');
const globalsSource = fs.readFileSync(globalsPath, 'utf8');

function loadGlobalsWithMocks(controllerMock, assignmentControllerMock, trackerMock) {
  const AssignmentDefinitionController = class {
    listAllPartialDefinitions(...args) {
      return controllerMock.listAllPartialDefinitions(...args);
    }
    getAllPartialDefinitions(...args) {
      return controllerMock.getAllPartialDefinitions(...args);
    }
    linkAssignmentToDefinition(...args) {
      return controllerMock.linkAssignmentToDefinition(...args);
    }
    createDefinitionFromUrls(...args) {
      return controllerMock.createDefinitionFromUrls(...args);
    }
  };

  const AssignmentController = class {
    startAssessmentFromWizard(...args) {
      return assignmentControllerMock.startAssessmentFromWizard(...args);
    }
  };

  const ProgressTracker = {
    getInstance: () => trackerMock,
  };

  const sandbox = {
    AssignmentDefinitionController,
    AssignmentController,
    ProgressTracker,
    Validate,
  };

  const context = vm.createContext(sandbox);
  new vm.Script(globalsSource, { filename: globalsPath }).runInContext(context);
  return { context };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Assignment definition globals', () => {
  it('listAllDefinitionsForWizard forwards to controller', () => {
    const controllerMock = {
      listAllPartialDefinitions: vi.fn().mockReturnValue([{ definitionKey: 'alpha' }]),
      getAllPartialDefinitions: vi.fn(),
      linkAssignmentToDefinition: vi.fn(),
      createDefinitionFromUrls: vi.fn(),
    };
    const assignmentControllerMock = {
      startAssessmentFromWizard: vi.fn(),
    };
    const trackerMock = {
      logAndThrowError: vi.fn(),
    };

    const { context } = loadGlobalsWithMocks(controllerMock, assignmentControllerMock, trackerMock);

    const result = context.listAllDefinitionsForWizard();

    expect(controllerMock.listAllPartialDefinitions).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ definitionKey: 'alpha' }]);
  });

  it('linkAssignmentToDefinition forwards payload', () => {
    const controllerMock = {
      listAllPartialDefinitions: vi.fn(),
      getAllPartialDefinitions: vi.fn(),
      linkAssignmentToDefinition: vi.fn().mockReturnValue({ definitionKey: 'alpha' }),
      createDefinitionFromUrls: vi.fn(),
    };
    const assignmentControllerMock = {
      startAssessmentFromWizard: vi.fn(),
    };
    const trackerMock = {
      logAndThrowError: vi.fn(),
    };

    const { context } = loadGlobalsWithMocks(controllerMock, assignmentControllerMock, trackerMock);

    const payload = { definitionKey: 'alpha', alternateTitle: 'Alpha', alternateTopic: 'Topic' };
    const result = context.linkAssignmentToDefinition(payload);

    expect(controllerMock.linkAssignmentToDefinition).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ definitionKey: 'alpha' });
  });

  it('createDefinitionFromUrls forwards payload', () => {
    const controllerMock = {
      listAllPartialDefinitions: vi.fn(),
      getAllPartialDefinitions: vi.fn(),
      linkAssignmentToDefinition: vi.fn(),
      createDefinitionFromUrls: vi.fn().mockReturnValue({ definitionKey: 'alpha' }),
    };
    const assignmentControllerMock = {
      startAssessmentFromWizard: vi.fn(),
    };
    const trackerMock = {
      logAndThrowError: vi.fn(),
    };

    const { context } = loadGlobalsWithMocks(controllerMock, assignmentControllerMock, trackerMock);

    const payload = {
      assignmentId: 'a1',
      courseId: 'course-1',
      primaryTitle: 'Alpha',
      primaryTopic: 'Topic',
      referenceUrl: 'https://docs.google.com/presentation/d/alpha',
      templateUrl: 'https://docs.google.com/presentation/d/beta',
    };

    const result = context.createDefinitionFromUrls(payload);

    expect(controllerMock.createDefinitionFromUrls).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ definitionKey: 'alpha' });
  });

  it('startAssessmentFromWizard forwards to AssignmentController', () => {
    const controllerMock = {
      listAllPartialDefinitions: vi.fn(),
      getAllPartialDefinitions: vi.fn(),
      linkAssignmentToDefinition: vi.fn(),
      createDefinitionFromUrls: vi.fn(),
    };
    const assignmentControllerMock = {
      startAssessmentFromWizard: vi.fn().mockReturnValue('ok'),
    };
    const trackerMock = {
      logAndThrowError: vi.fn(),
    };

    const { context } = loadGlobalsWithMocks(controllerMock, assignmentControllerMock, trackerMock);

    const result = context.startAssessmentFromWizard('a1', 'def-key');

    expect(assignmentControllerMock.startAssessmentFromWizard).toHaveBeenCalledWith(
      'a1',
      'def-key'
    );
    expect(result).toBe('ok');
  });

  it('logs and throws when controller throws', () => {
    const controllerMock = {
      listAllPartialDefinitions: vi.fn(() => {
        throw new Error('Boom');
      }),
      getAllPartialDefinitions: vi.fn(),
      linkAssignmentToDefinition: vi.fn(),
      createDefinitionFromUrls: vi.fn(),
    };
    const assignmentControllerMock = {
      startAssessmentFromWizard: vi.fn(),
    };
    const trackerMock = {
      logAndThrowError: vi.fn(() => {
        throw new Error('Wrapped');
      }),
    };

    const { context } = loadGlobalsWithMocks(controllerMock, assignmentControllerMock, trackerMock);

    expect(() => context.listAllDefinitionsForWizard()).toThrow('Wrapped');
    expect(trackerMock.logAndThrowError).toHaveBeenCalled();
  });
});
