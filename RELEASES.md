# 🚀 v0.5.0

## ✨ Enhancements

* **Spreadsheet Formula Assessment:** Introduced comprehensive support for assessing Google Sheets formulae. Student spreadsheet submissions are now automatically evaluated for Completeness, Accuracy, and SPaG, with detailed reasoning and scoring.
* **New Assessment Classes:** Added `SheetsAssessor`, `SheetsParser`, and related classes to handle extraction, comparison, and assessment of spreadsheet tasks and student responses.
* **Progress Tracking:** Enhanced progress logging throughout the spreadsheet assessment workflow, including during formula extraction, response processing, and image uploads.
* **Formula Normalisation:** Implemented robust formula normalisation to ensure accurate comparison, including handling of case, quotes, and Google Apps Script formula output quirks.
* **Batch Operations:** Optimised Google Sheets API usage with batch operations for improved performance and reduced rate limiting.
* **Improved Error Handling:** Expanded error logging with user-facing and developer-facing details, and integrated error tracking into the progress tracker for spreadsheet workflows.
* **Assignment Workflow Improvements:** Refined assignment and response extraction logic for both slides and sheets, improving reliability and clarity.
* **UI and Logging Updates:** Updated UI and logging to reflect new spreadsheet assessment features and provide clearer feedback during processing.

## 🐛 Bug Fixes

* **Formula Comparison:** Fixed issues with mismatched or complex ranges causing incorrect formula assessment results.
* **Progress Tracker:** Ensured progress tracker is correctly initialised and updated during all assessment stages.
* **Error Logging:** Improved error logging structure to avoid duplication and provide more actionable debugging information.
* **Assignment Data Handling:** Addressed issues with missing or mismatched student responses and reference tasks.
* **Task Extraction:** Fixed bugs in task extraction and response assignment for both slides and sheets.

## 🔄 Refactoring

* **Class Structure:** Refactored and streamlined task, assignment, and parser classes to support both slides and sheets workflows.
* **Singleton Pattern:** Improved singleton instantiation for progress tracking and UI management.
* **Method Optimisation:** Split large methods into smaller, focused units for better maintainability and clarity.
* **Naming Consistency:** Updated class and method names for consistency and clarity across the codebase.

## 📄 New Documentation

* **Spreadsheet Assessment:** Added documentation and inline comments for new spreadsheet assessment features and formula handling.
* **Error Handling:** Expanded JSDoc and inline documentation for error handling and progress tracking.

## 📚 Sheet Copies

You can find copies of the sheets with the latest code in this Google Drive folder: [Google Drive Folder](https://drive.google.com/drive/folders/1Ah-hUohthVpk_D2b4e9d0s7dsSaae7tN?usp=sharing)

## ⬆️ Updating to v0.5.0

If you already have Assessment Bot running, you can update to v0.5.0 by following these steps:

1. Open your existing Admin Sheet.
2. Click on **Assessment Bot** -> **Settings** -> **Update Version**.
3. Select the **v0.5.0** option and follow the instructions.

## 📋 Detailed Commit History

* See `commitHistory.txt` for a full list of changes included in this release, with detailed commit messages for all spreadsheet assessment features and supporting updates.

# 🚀 v0.4.3

## ✨ Enhancements

* **Performance Improvements:** Optimised code for better performance when handling large classes.
* **UI Refinements:** Enhanced user interface elements for improved usability.
* **Documentation Updates:** Expanded documentation with clearer instructions and examples.
* **Configuration Dialog Improvements:** Reorganised with tabs for menu settings and reduced compulsory settings.
* **Auth Flow Improvements:** Changed authorisation and initialisation flow using installable `onOpen` trigger.
* **Error Handling:** Added improved error handling for 403/404 responses in API requests.
* **AI Model Updates:** Updated flows to use `gemini-2.0-flash` and `gemini-2.0-flash-lite` models.
* **Docker Integration:** Added Docker build action and Cloud Run support for Langflow backend.

## 🐛 Bug Fixes

* **Assessment Record Deserialisation:** Fixed issue with ensuring that assessment records reliably deserialise data after update.
* **Properties Store Check:** Fixed properties store check to ensure that data is reliably deserialised upon update.
* **Progress Tracker Updates:** Re-added lost `progressTracker` updates when cloning individual assessment records.
* **Typos:** Fixed typos that were causing the update mechanism to fail.
* **Cache Hashing:** Fixed caching mechanism to hash reference and content hashes rather than concatenating them.
* **Auth Revocation:** Improved handling of authorisation revocation for better script update flow.

## 🔄 Refactoring

* **Code Organisation:** Significantly refactored code into more logical components:
    * Created `InitController` class and moved global functions to dedicated files
    * Refactored `MainController` functionality into `Assignment` and `AssignmentController` classes
    * Implemented improved singleton pattern for `UIManager` and other classes
    * Added 'safe UI operation' pattern to avoid issues with UI calls in trigger contexts
* **Cohort Analysis:** Refactored cohort analysis functionality to avoid duplication
* **Backend Organisation:** Reorganised backend folder structure and removed outdated files

## 📄 New Documentation

* **AI Rules:** Added `airules.md` guidelines
* **Configuration Options:** Added `configOptions.md` explaining all configuration options
* **Code Structure:** Started code structure diagram for better documentation

## 📚 Sheet Copies

You can find copies of the sheets with the latest code in this Google Drive folder: [Google Drive Folder](https://drive.google.com/drive/folders/1Ah-hUohthVpk_D2b4e9d0s7dsSaae7tN?usp=sharing)

## ⬆️ Updating to v0.4.3

If you already have Assessment Bot running, you can update to v0.4.3 by following these steps:

1. Open your existing Admin Sheet.
2. Click on **Assessment Bot** -> **Settings** -> **Update Version**.
3. Select the **v0.4.3** option and follow the instructions.

## 📋 Detailed Commit History

* Reorganised `ConfigurationDialog.html` to have tabs for each menu settings
* Added error handling for 403 status in `BaseRequestManager`
* Added a `revokeAuthorisation` function to the assessment record
* Modified `createTimeBasedTrigger` to add the `triggerTime` parameter
* Fixed typos in `TriggerController` affecting method calls
* Added authentication revocation parameters and supporting code
* Changed auth and init flow with installable `onOpen` trigger
* Created `InitController` class and moved global functions
* Implemented initialisation of `ConfigurationManager` from properties store
* Added `airules.md` documentation
* Begun refactoring singleton instantiation to `singletons.js`
* Enhanced `UpdateManager` with error handling and cloning functionality
* Refactored `UpdateManager` into a `BaseUpdateAndInit` class
* Added `configOptions.md` explaining configuration options
* Updated README and fixed URLs
* Added extra error handling to `InitController`
* Encapsulated UI and Google Classroom logic
* Improved Google Classroom integration and initialisation
* Reintroduced the `warmUpLLM` method
* Modified `ProgressModal` UI elements
* Started code structure diagram
* Made the grammar assessment harsher
* Fixed caching mechanism to hash reference and content hashes
* Added Docker build action for Langflow image
* Updated flows to use newer Gemini models
* Added 'Deploy with Cloud Run' button
* Refactored cohort analysis functionality
* Fixed bugs with Assessment Record Sheet IDs
* Implemented 'safe UI operation' pattern
* Added handling for authorisation parameters
* Updated GitHub Actions workflow for testing and deployment

# 🚀 v0.4.2

## ✨ Enhancements

* **Config Modal Updates:** Improved the usability of the Config Modal.
* **`gh` package**: Added the `gh` package `Github` so that project IDX can use the Github CLI utilities.
* **Version Bump**: Bumped version no in `UpdateManager` and added latest file IDs to `assessmentBotVersions.json`

## 🐛 Bug Fixes

* **Assessment Record Deserialisation:** Fixed issue with ensuring that assessment records reliably deserialise data after update.
* **Properties Store Check:** Fixed properties store check to ensure that data is reliably deserialised upon update.
* **Progress Tracker Updates**: Re-added lost `progressTracker` updates when cloning individual assessment records.
* **Typos**: Fixed typos that were causing the update mechanism to fail.

## 🗑️ Removals

* **`cunningPlan.md`**: Removed outdated `cunningPlan.md` update workflow documentation.

## 📚 Sheet Copies

You can find copies of the sheets with the latest code in this Google Drive folder: [Google Drive Folder](https://drive.google.com/drive/folders/18uGYzFrfW5nFTEvl04VcgpL_DQGLduNU?usp=sharing)

## ⬆️ Updating to v0.4.2

If you already have Assessment Bot running, you can update to v0.4.2 by following these steps:

1. Open your existing Admin Sheet.
2. Click on **Assessment Bot** -> **Settings** -> **Update Version**.
3. Select the **v0.4.2** option and follow the instructions.

# 🚀 v0.4.1

## ✨ Enhancements

* **Improved Student Fetching:** Added a loop to `fetchAllStudents` method to ensure all students are added, even in classes larger than 30 students. (Closes #21)
* **Explicit Auth Scopes:**  Added explicit auth scopes in `appscript.json` to address potential authorisation issues. (#17)
* **Repo Rename Updates**: Updated update URLs after repository rename.
* **Version Bump**: Bumped version to v0.4.1

## 🐛 Bug Fixes

* **Admin Sheet Validation:** Correctly validates whether the current sheet is an admin sheet, preventing the `Classrooms` sheet from being incorrectly created in assessment records.
* **Image Upload URL:** Fixed `imageUploadUrl` generation in `Configuration Manager`. (Fixes #20)
* **Loading State:** `UpdateManager` now deletes the Script property after successful loading.
* **Admin Sheet Check:** Added an AdminSheet check to avoid instantiating `ClassroomSheetManager` incorrectly. (Fixes #16)

## 🤝 Merged Pull Requests

* Merge pull request #22 from h-arnold:UpdateManager

## 📚 Sheet Copies

You can find copies of the sheets with the latest code in this Google Drive folder: [Google Drive Folder](https://drive.google.com/drive/folders/1V3PU0W1-D1rqGZ3ztmowcnk9HHM-taeK?usp=sharing)

## ⬆️ Updating to v0.4.1

If you already have Assessment Bot running, you can update to v0.4.1 by following these steps:

1. Open your existing Admin Sheet.
2. Click on **Assessment Bot** -> **Settings** -> **Update Version**.
3. Select the **v0.4.1** option and follow the instructions.