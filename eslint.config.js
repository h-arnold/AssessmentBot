const googleappsscript = require('eslint-plugin-googleappsscript');

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        // --- Add your custom globals here ---
        ClassroomApiClient: 'readonly',
        DriveManager: 'readonly',
        Assessment: 'readonly',
        Assignment: 'readonly',
        GoogleClassroom: 'readonly',
        Student: 'readonly',
        StudentTask: 'readonly',
        Task: 'readonly',
        BaseSheetManager: 'readonly',
        AnalysisSheetManager: 'readonly',
        ClassAssessmentSheet: 'readonly',
        ClassroomSheetManager: 'readonly',
        CohortAnalysisSheetManager: 'readonly',
        MultiSheetExtractor: 'readonly',
        OverviewSheetManager: 'readonly',
        SummarySheetManager: 'readonly',
        AssignmentPropertiesManager: 'readonly',
        ConfigurationManagerClass: 'readonly',
        ProgressTracker: 'readonly',
        TriggerController: 'readonly',
        Utils: 'readonly',
        CacheManager: 'readonly',
        ImageManager: 'readonly',
        LLMRequestManager: 'readonly',
        UIManager: 'readonly',
        MainController: 'readonly',
      },
    },
    plugins: { googleappsscript },
  },
];