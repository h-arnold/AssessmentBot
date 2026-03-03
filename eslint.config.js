const googleappsscript = require('eslint-plugin-googleappsscript');
const jsdoc = require('eslint-plugin-jsdoc');

module.exports = [
  {
    // ignore the legacy GAS source folders entirely rather than linting them
    ignores: ['src/AdminSheet/**', 'src/AssessmentRecordTemplate/**'],
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
      },
    },
    plugins: { googleappsscript, jsdoc },
    rules: {
      // Prevent accidental redefinition of BaseSingleton outside the canonical file.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Program:not([sourceType='module']) VariableDeclarator[id.name='BaseSingleton']",
          message:
            'Do not declare a global BaseSingleton in individual files. Use src/AdminSheet/00_BaseSingleton.js for the canonical implementation.',
        },
        {
          selector:
            "AssignmentExpression[left.object.name='globalThis'][left.property.name='BaseSingleton']",
          message:
            'Do not assign to globalThis.BaseSingleton outside src/AdminSheet/00_BaseSingleton.js; require the canonical base in tests instead.',
        },
        {
          selector: "AssignmentExpression[left.name='BaseSingleton']",
          message:
            'Do not assign to BaseSingleton identifier outside src/AdminSheet/00_BaseSingleton.js; keep the canonical implementation in that single file.',
        },
        // Prevent direct singleton constructor calls (except in defining modules and tests)
        {
          selector: "NewExpression[callee.name='ConfigurationManager']",
          message:
            'Use ConfigurationManager.getInstance() instead of new ConfigurationManager(). Direct constructor calls violate the singleton pattern.',
        },
        {
          selector: "NewExpression[callee.name='UIManager']",
          message:
            'Use UIManager.getInstance() instead of new UIManager(). Direct constructor calls violate the singleton pattern.',
        },
        {
          selector: "NewExpression[callee.name='ProgressTracker']",
          message:
            'Use ProgressTracker.getInstance() instead of new ProgressTracker(). Direct constructor calls violate the singleton pattern.',
        },
        {
          selector: "NewExpression[callee.name='InitController']",
          message:
            'Use InitController.getInstance() instead of new InitController(). Direct constructor calls violate the singleton pattern.',
        },
      ],
      'jsdoc/require-jsdoc': [
        'warn',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
        },
      ],
      'no-magic-numbers': [
        'warn',
        {
          ignore: [0, 1],
          ignoreArrayIndexes: true,
          enforceConst: true,
          detectObjects: false,
        },
      ],
    },
  },
];
