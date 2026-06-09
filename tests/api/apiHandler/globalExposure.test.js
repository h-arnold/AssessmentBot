import { describe, expect, it } from 'vitest';

const {
  loadModuleGlobalsInVmContext,
  googleClassroomsHandlerPath,
  abclassMutationsPath,
  assignmentDefinitionTransportPath,
  apiConfigPath,
} = require('./shared.js');

describe('Api/non-trivial transport helper global exposure', () => {
  it('exposes only getGoogleClassrooms_ in vm context after loading googleClassrooms module', () => {
    const context = loadModuleGlobalsInVmContext(googleClassroomsHandlerPath);

    expect(context.getGoogleClassrooms).toBeUndefined();
    expect(context.getGoogleClassrooms_).toEqual(expect.any(Function));
  });

  it('exposes only trailing-underscore globals for non-trivial transport modules in vm context', () => {
    const abclassContext = loadModuleGlobalsInVmContext(abclassMutationsPath);
    expect(abclassContext.upsertABClass).toBeUndefined();
    expect(abclassContext.updateABClass).toBeUndefined();
    expect(abclassContext.deleteABClass).toBeUndefined();
    expect(abclassContext.upsertABClass_).toEqual(expect.any(Function));
    expect(abclassContext.updateABClass_).toEqual(expect.any(Function));
    expect(abclassContext.deleteABClass_).toEqual(expect.any(Function));

    const assignmentDefinitionContext = loadModuleGlobalsInVmContext(
      assignmentDefinitionTransportPath
    );
    expect(assignmentDefinitionContext.getAssignmentDefinitionPartials).toBeUndefined();
    expect(assignmentDefinitionContext.getAssignmentDefinition).toBeUndefined();
    expect(assignmentDefinitionContext.deleteAssignmentDefinition).toBeUndefined();
    expect(assignmentDefinitionContext.getAssignmentDefinitionPartials_).toEqual(
      expect.any(Function)
    );
    expect(assignmentDefinitionContext.getAssignmentDefinition_).toEqual(expect.any(Function));
    expect(assignmentDefinitionContext.deleteAssignmentDefinition_).toEqual(expect.any(Function));

    const backendConfigContext = loadModuleGlobalsInVmContext(apiConfigPath);
    expect(backendConfigContext.getBackendConfig).toBeUndefined();
    expect(backendConfigContext.setBackendConfig).toBeUndefined();
    expect(backendConfigContext.getBackendConfig_).toEqual(expect.any(Function));
    expect(backendConfigContext.setBackendConfig_).toEqual(expect.any(Function));
  });
});
