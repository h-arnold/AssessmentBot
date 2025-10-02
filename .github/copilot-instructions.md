# AssessmentBot Code Schema

## Project

- TYPE: Google Apps Script assessment tool
- DOMAIN: Education, Google Classroom
- FUNCTION: Evaluate student slide submissions against references
- ASSESSMENT_CRITERIA: {Completeness, Accuracy, SPaG}
- MARKERS: {Text:"#", Images:"~|"}
- DATA_STORAGE: Google Sheets
- COMPLIANCE: GDPR (data within Google Workspace)

## Architecture

- FRONTEND: Google Apps Script
- BACKEND: [Assessment Bot Backend](https://github.com/h-arnold/AssessmentBot-Backend)
- STORAGE: Google Sheets - soon to be [JsonDBApp](https://github.com/h-arnold/JsonDbApp)

## Code_Standards

ALL NAMES: Prefer full words; avoid abbreviations unless widely recognised.

- CLASS_NAMING: PascalCase
- METHOD_NAMING: camelCase
- VARIABLE_NAMING: camelCase
- CONSTANTS: const
- VARIABLES: let
- LANGUAGE: British English
- INDENTATION: 2 spaces
- PATHS:
  - CORE: /src/AdminSheet
  - CONTROLLERS: /src/AdminSheet/z_Controllers
- LOAD_ORDER: numeric prefixes (0BaseSheetManager.js)

## Implementation_Patterns

- INSTANTIATION: lazy
- DESIGN: dependency injection
- METHODS: small, focused
- SERVICES: singletons /src/AdminSheet/00_BaseSingleton.js
- ERROR_HANDLING:
  - USER_FACING: this.progressTracker.logError(errorMessage, extraErrorDetails)
  - DEV_FACING: Use the project-wide `ABLogger` (see `src/AdminSheet/Utils/ABLogger.js`) for non-user-facing developer logs and errors. Prefer calling `ABLogger.getInstance()` (for example: `ABLogger.getInstance().debugUi(...)`) rather than `console.error` — we are gradually migrating to `ABLogger`, so all new code should use it. Do not duplicate `ABLogger.error` after `ProgressTracker.getInstance().logError`; pass extra details to `logError` as the second parameter for developer logs.
  - STRUCTURE: try/catch blocks
 - FAIL FAST: Avoid fallbacks - better to throw or have uncaught exceptions than silent failures.

  - OPTIONAL CHAINING & UNHANDLED EXCEPTIONS (LLM-OPTIMISED):
    - Use `?.` for nullable/deep property access. Do not use to silently ignore required values; validate and throw/log if required.
    - Top-level or trigger handlers: wrap in `try/catch`, call `this.progressTracker.logError(msg, details)` and `ABLogger.getInstance().error(msg, err)`.

## Documentation

- FORMAT: JSDoc
- COMPONENTS: {description, @param, @return, @remarks}
- STYLE: British English
- INLINE: for complex logic

## Classes and paths

Below is a harvested (non-exhaustive) list of classes found in the codebase and their file locations. Use these when referencing types, singletons, or when adding new code that must interoperate with existing classes.

- `BaseSingleton` - `src/AdminSheet/00_BaseSingleton.js`
- `ABLogger` - `src/AdminSheet/Utils/ABLogger.js`
- `ProgressTracker` - `src/AdminSheet/Utils/ProgressTracker.js`
- `ConfigurationManager` - `src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js`
- `DbManager` - `src/AdminSheet/DbManager/DbManager.js`

- Controllers
  - `UpdateController` - `src/AdminSheet/y_controllers/UpdateController.js`
  - `GoogleClassroomController` - `src/AdminSheet/y_controllers/GoogleClassroomController.js`
  - `InitController` - `src/AdminSheet/y_controllers/InitController.js`
  - `AssignmentController` - `src/AdminSheet/y_controllers/AssignmentController.js`
  - `CohortAnalysisController` - `src/AdminSheet/y_controllers/CohortAnalysisController.js`

- Sheet managers (Base + specialised)
  - `BaseSheetManager` - `src/AdminSheet/Sheets/0BaseSheetManager.js`
  - `TaskSheet` - `src/AdminSheet/Sheets/TaskSheet.js`
  - `OverviewSheetManager` - `src/AdminSheet/Sheets/OverviewSheetManager.js`
  - `CohortAnalysisSheetManager` - `src/AdminSheet/Sheets/CohortAnalysisSheetManager.js`
  - `ClassroomSheetManager` - `src/AdminSheet/Sheets/ClassroomSheetManager.js`
  - `SummarySheetManager` - `src/AdminSheet/Sheets/SummarySheetManager.js`
  - `AnalysisSheetManager` - `src/AdminSheet/Sheets/AnalysisSheetManager.js`
  - `ClassAssessmentSheet` - `src/AdminSheet/Sheets/ClassAssessmentSheet.js`
  - `MultiSheetExtractor` - `src/AdminSheet/Sheets/MultiSheetExtractor.js`

- Update & init
  - `BaseUpdateAndInit` - `src/AdminSheet/UpdateAndInitManager/BaseUpdateAndInitManager.js`
  - `UpdateManager` - `src/AdminSheet/UpdateAndInitManager/UpdateManager.js`
  - `FirstRunManager` - `src/AdminSheet/UpdateAndInitManager/FirstRunManager.js`
  - `SheetCloner` - `src/AdminSheet/UpdateAndInitManager/SheetCloner.js`
  - `PropertiesCloner` - `src/AdminSheet/UpdateAndInitManager/PropertiesCloner.js`

- Assignment processing and assessment
  - `Assignment` - `src/AdminSheet/AssignmentProcessor/Assignment.js`
  - `SheetsAssignment` - `src/AdminSheet/AssignmentProcessor/SheetsAssignment.js`
  - `SlidesAssignment` - `src/AdminSheet/AssignmentProcessor/SlidesAssignment.js`

- Models
  - `ABClass` - `src/AdminSheet/Models/ABClass.js`
  - `ABClassManager` - `src/AdminSheet/Models/ABClassManager.js`
  - `Student` - `src/AdminSheet/Models/Student.js`
  - `Teacher` - `src/AdminSheet/Models/Teacher.js`
  - `StudentSubmission` - `src/AdminSheet/Models/StudentSubmission.js`
  - `Assessment` - `src/AdminSheet/Models/Assessment.js`
  - `TaskDefinition` - `src/AdminSheet/Models/TaskDefinition.js`

- Artifacts
  - `BaseTaskArtifact` - `src/AdminSheet/Models/Artifacts/0_BaseTaskArtifact.js`
  - `TextTaskArtifact` - `src/AdminSheet/Models/Artifacts/1_TextTaskArtifact.js`
  - `TableTaskArtifact` - `src/AdminSheet/Models/Artifacts/2_TableTaskArtifact.js`
  - `SpreadsheetTaskArtifact` - `src/AdminSheet/Models/Artifacts/3_SpreadsheetTaskArtifact.js`
  - `ImageTaskArtifact` - `src/AdminSheet/Models/Artifacts/4_ImageTaskArtifact.js`
  - `ArtifactFactory` - `src/AdminSheet/Models/Artifacts/5_ArtifactFactory.js`

- Request handlers / managers
  - `BaseRequestManager` - `src/AdminSheet/RequestHandlers/BaseRequestManager.js`
  - `LLMRequestManager` - `src/AdminSheet/RequestHandlers/LLMRequestManager.js`
  - `ImageManager` - `src/AdminSheet/RequestHandlers/ImageManager.js`
  - `CacheManager` - `src/AdminSheet/RequestHandlers/CacheManager.js`

- Document parsers
  - `DocumentParser` - `src/AdminSheet/DocumentParsers/DocumentParser.js`
  - `SlidesParser` - `src/AdminSheet/DocumentParsers/SlidesParser.js`
  - `SheetsParser` - `src/AdminSheet/DocumentParsers/SheetsParser.js`

- Feedback & population
  - `SheetsFeedback` - `src/AdminSheet/FeedbackPopulators/SheetsFeedback.js`

- Google integrations / utilities
  - `GoogleClassroomManager` - `src/AdminSheet/GoogleClassroom/GoogleClassroomManager.js`
  - `ClassroomApiClient` - `src/AdminSheet/GoogleClassroom/ClassroomApiClient.js`
  - `DriveManager` - `src/AdminSheet/GoogleDriveManager/DriveManager.js`
  - `UIManager` - `src/AdminSheet/UI/UIManager.js`
  - `ScriptAppManager` - `src/AdminSheet/Utils/ScriptAppManager.js`
  - `TriggerController` - `src/AdminSheet/Utils/TriggerController.js`

- Misc / utilities
  - `BatchUpdateUtility` - `src/AdminSheet/Utils/BatchUpdateUtility.js`
  - `Utils` - `src/AdminSheet/Utils/Utils.js`
  - `Validate` - `src/AdminSheet/Utils/Validate.js`
  - `AssignmentPropertiesManager` - `src/AdminSheet/Utils/AssignmentPropertiesManager.js`


## Google_APIs

- SPREADSHEETS: SpreadsheetApp
- SLIDES: SlidesApp
- FILES: DriveApp
- CLASSROOM: ClassroomApp
- OPTIMIZATION: batch operations
- LIMITS: handle rate limits and quotas

## Testing Framework (Local, Non-GAS)

- FRAMEWORK: Vitest (lightweight Jest-compatible runner)
- CONFIG: `vitest.config.js` (plain object export, avoids Vite ESM import)
- SETUP FILE: `tests/setupGlobals.js`
  - Provides shims: `Utils.generateHash`, `Utilities.base64Encode`, `Logger.log`.
  - Exposes `ArtifactFactory` globally for models referencing it indirectly.
- TEST LOCATION: `tests/**/*.test.js`
- COMMANDS:
  - Run once: `npm test` (alias for `vitest run`)
  - Watch mode: `npm run test:watch`
- SCOPE: Only pure logic / model code. Do NOT invoke Google Apps Script APIs (SlidesApp, DriveApp, etc.).
- STUBBING: If a model needs a GAS value, refactor to accept primitives or inject a stub object created inside the test.
- HASH STABILITY: Tests assume hash function is deterministic; avoid assertions on specific hash strings, only truthiness / inequality for changed content.
- ARTIFACTS: All artifact tests should use primitive content (strings, arrays, Uint8Array for images) to keep environment independent of GAS.
- SERIALISATION: Round-trip tests must use `toJSON()` / `fromJSON()` only—avoid deep cloning tricks that depend on execution context.
- NEW TESTS: When adding a new model or feature, include at least: normalisation behaviour, hashing consistency, JSON round-trip, and edge cases (empty, null, large input where applicable).
- PROHIBITED IN TESTS: Direct use of Apps Script services, network calls, timers reliant on GAS environment.
- FUTURE EXTENSION: Add coverage by installing `@vitest/coverage-v8` and running `vitest run --coverage` (not yet configured).

## Singleton loading pattern (BaseSingleton)

We centralise singleton base behaviour in a single canonical file and enforce that policy in tests and linting.

- Canonical implementation: `src/AdminSheet/00_BaseSingleton.js`
  - This file contains the complete behaviour (static `getInstance`, `_createInstance`, `resetForTests`, `_maybeFreeze`, etc.).
  - It is the single source of truth for singleton lifecycle and test helpers.

- Tests: always load the canonical base in the test bootstrap
  - To ensure unit tests use the full behaviour, require the canonical base early in `tests/setupGlobals.js`:

```javascript
// tests/setupGlobals.js
require('../src/AdminSheet/00_BaseSingleton.js');
```

- How to import a singleton safely in isolation **for tests only**:
  - If you need to require a singleton module in isolation (for a quick script or one-off test), require the canonical base first, then the singleton:

**Note**: this pattern should be used in tests only. NEVER use it in production code.
```javascript
require('../src/AdminSheet/00_BaseSingleton.js');
const ConfigurationManager = require('../src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js');
```

## Important Notes

- Only implement the code requested.
- Ask for clarification if the request is ambiguous.
- Check for existing code before creating new methods.
- Avoid code for tests in production files.
- Always write in British English.
- Update code with British English spelling if you find American English.

## THE MOST IMPORTANT NOTE

KISS - Keep it simple, stupid! Always prefer the simplest solution that works. Assume that the user will ask for additional validation, error handling etc if they want it. Never add extra complexity "just in case".

