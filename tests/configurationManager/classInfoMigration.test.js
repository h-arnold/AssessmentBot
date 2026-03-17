import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupGlobalGASMocks } from '../helpers/mockFactories.js';

const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

describe('ConfigurationManager class-info removal', () => {
  beforeEach(() => {
    setupGlobalGASMocks(vi);
    ConfigurationManager.instance = null;
  });

  it('does not expose removed class-info APIs', () => {
    const configManager = new ConfigurationManager();

    expect(configManager.getClassInfo).toBeUndefined();
    expect(configManager.setClassInfo).toBeUndefined();
    expect(configManager.getAssessmentRecordCourseId).toBeUndefined();
    expect(configManager.setAssessmentRecordCourseId).toBeUndefined();
  });

  it('does not include removed class-info key in config keys', () => {
    expect(ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_CLASS_INFO).toBeUndefined();
    expect(ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_COURSE_ID).toBeUndefined();
  });
});
