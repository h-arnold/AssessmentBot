const googleappsscript = require('eslint-plugin-googleappsscript');

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        // Project singletons and global classes exposed to GAS
        Assessment: 'readonly',
        Assignment: 'readonly',
        AssessmentRecord: 'readonly',
        Student: 'readonly',
        StudentSubmission: 'readonly',
        TaskDefinition: 'readonly',
        BaseTaskArtifact: 'readonly',
        TextTaskArtifact: 'readonly',
        TableTaskArtifact: 'readonly',
        SpreadsheetTaskArtifact: 'readonly',
        ImageTaskArtifact: 'readonly',
        ArtifactFactory: 'readonly',

        // Managers / controllers / utilities used as globals or singletons
        Utils: 'readonly',
        ProgressTracker: 'readonly',
        UIManager: 'readonly',
        ConfigurationManagerClass: 'readonly',
        LLMRequestManager: 'readonly',
        CacheManager: 'readonly',
        ImageManager: 'readonly',
        TriggerController: 'readonly',

        // Sheet managers and extractors
        BaseSheetManager: 'readonly',
        AnalysisSheetManager: 'readonly',
        ClassAssessmentSheet: 'readonly',
        ClassroomSheetManager: 'readonly',
        CohortAnalysisSheetManager: 'readonly',
        MultiSheetExtractor: 'readonly',
        OverviewSheetManager: 'readonly',
        SummarySheetManager: 'readonly',
        AssignmentPropertiesManager: 'readonly',
      },
    },
    plugins: { googleappsscript },
    rules: {
      // Enforce using the aggregator instead of direct numbered artifact files.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../src/AdminSheet/Models/Artifacts/0_BaseTaskArtifact.js',
              message:
                'Import from Models/Artifacts/index.js instead of individual artifact files.',
            },
            {
              name: '../src/AdminSheet/Models/Artifacts/1_TextTaskArtifact.js',
              message:
                'Import from Models/Artifacts/index.js instead of individual artifact files.',
            },
            {
              name: '../src/AdminSheet/Models/Artifacts/2_TableTaskArtifact.js',
              message:
                'Import from Models/Artifacts/index.js instead of individual artifact files.',
            },
            {
              name: '../src/AdminSheet/Models/Artifacts/3_SpreadsheetTaskArtifact.js',
              message:
                'Import from Models/Artifacts/index.js instead of individual artifact files.',
            },
            {
              name: '../src/AdminSheet/Models/Artifacts/4_ImageTaskArtifact.js',
              message:
                'Import from Models/Artifacts/index.js instead of individual artifact files.',
            },
            {
              name: '../src/AdminSheet/Models/Artifacts/5_ArtifactFactory.js',
              message:
                'Import from Models/Artifacts/index.js instead of individual artifact files.',
            },
          ],
          patterns: [
            {
              group: ['**/Models/Artifacts/[0-9]_*.js'],
              message:
                'Use Models/Artifacts/index.js as the import surface, not numbered artifact files.',
            },
          ],
        },
      ],
    },
  },
];
