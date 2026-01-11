import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const globalsPath = path.resolve(__dirname, '../../src/AdminSheet/UI/97_globals.js');
const globalsSource = fs.readFileSync(globalsPath, 'utf8');

function loadGlobalsWithMock(handlerMock) {
  const BeerCSSUIHandler = {
    getInstance: vi.fn(() => handlerMock),
  };
  const sandbox = { BeerCSSUIHandler };
  const context = vm.createContext(sandbox);
  new vm.Script(globalsSource, { filename: globalsPath }).runInContext(context);
  return { context, BeerCSSUIHandler };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UI global wrappers', () => {
  it('forwards calls to the BeerCSS UI handler', () => {
    const handlerMock = {
      openReferenceSlideModal: vi.fn(() => 'opened'),
      showProgressModal: vi.fn(),
      showConfigurationDialog: vi.fn(() => 'configuration-dialog'),
      showAssignmentDropdown: vi.fn(() => 'assignment-dropdown'),
      showAssessmentWizard: vi.fn(),
      showClassroomDropdown: vi.fn(() => 'classroom-dropdown'),
      saveDocumentIdsForAssignment: vi.fn(() => 'definition-key'),
      showVersionSelector: vi.fn(() => 'version-dialog'),
      getClassroomData: vi.fn(() => ({ id: 'classroom' })),
      saveClassroomData: vi.fn(),
      showClassroomEditorModal: vi.fn(),
    };

    const { context, BeerCSSUIHandler } = loadGlobalsWithMock(handlerMock);
    const {
      showProgressModal,
      showConfigurationDialog,
      showAssignmentDropdown,
      showAssessmentWizard,
      showClassroomDropdown,
      showVersionSelector,
      openReferenceSlideModal,
      saveDocumentIdsForAssignment,
      getClassroomData,
      saveClassroomData,
      showClassroomEditorModal,
    } = context;

    showProgressModal();
    showConfigurationDialog();
    showAssignmentDropdown();
    showAssessmentWizard();
    showClassroomDropdown();

    const versionResult = showVersionSelector();
    const openResult = openReferenceSlideModal('{"id":"assignment"}');
    const definitionKey = saveDocumentIdsForAssignment('assignment', {
      referenceDocumentId: 'doc',
    });
    const classroomPayload = getClassroomData();
    saveClassroomData([{ id: 'c1' }]);
    showClassroomEditorModal();

    expect(handlerMock.showProgressModal).toHaveBeenCalledTimes(1);
    expect(handlerMock.showConfigurationDialog).toHaveBeenCalledTimes(1);
    expect(handlerMock.showAssignmentDropdown).toHaveBeenCalledTimes(1);
    expect(handlerMock.showAssessmentWizard).toHaveBeenCalledTimes(1);
    expect(handlerMock.showClassroomDropdown).toHaveBeenCalledTimes(1);
    expect(handlerMock.showVersionSelector).toHaveBeenCalledTimes(1);
    expect(handlerMock.openReferenceSlideModal).toHaveBeenCalledWith('{"id":"assignment"}');
    expect(handlerMock.saveDocumentIdsForAssignment).toHaveBeenCalledWith('assignment', {
      referenceDocumentId: 'doc',
    });
    expect(handlerMock.getClassroomData).toHaveBeenCalledTimes(1);
    expect(handlerMock.saveClassroomData).toHaveBeenCalledWith([{ id: 'c1' }]);
    expect(handlerMock.showClassroomEditorModal).toHaveBeenCalledTimes(1);

    expect(versionResult).toBe('version-dialog');
    expect(openResult).toBe('opened');
    expect(definitionKey).toBe('definition-key');
    expect(classroomPayload).toEqual({ id: 'classroom' });
    expect(BeerCSSUIHandler.getInstance).toHaveBeenCalledTimes(11);
  });
});
