# 🚀 v0.4.2

## ✨ Enhancements

*   **Config Modal Updates:** Improved the usability of the Config Modal.
*   **`gh` package**: Added the `gh` package `Github` so that project IDX can use the Github CLI utilities.
*   **Version Bump**: Bumped version no in `UpdateManager` and added latest file IDs to `assessmentBotVersions.json`

## 🐛 Bug Fixes

*   **Assessment Record Deserialization:** Fixed issue with ensuring that assessment records reliably deserialise data after update.
*   **Properties Store Check:** Fixed properties store check to ensure that data is reliably deserialised upon update.
*   **Progress Tracker Updates**: Re-added lost `progressTracker` updates when cloning individual assessment records.
*   **Typos**: Fixed typos that were causing the update mechanism to fail.


## 🗑️ Removals

*   **`cunningPlan.md`**: Removed outdated `cunningPlan.md` update workflow documentation.

## 📚 Sheet Copies

You can find copies of the sheets with the latest code in this Google Drive folder: [Google Drive Folder](https://drive.google.com/drive/folders/18uGYzFrfW5nFTEvl04VcgpL_DQGLduNU?usp=sharing)

## ⬆️ Updating to v0.4.2

If you already have Assessment Bot running, you can update to v0.4.2 by following these steps:

1.  Open your existing Admin Sheet.
2.  Click on **Assessment Bot** -> **Settings** -> **Update Version**.
3.  Select the **v0.4.2** option and follow the instructions.

# 🚀 v0.4.1

## ✨ Enhancements

*   **Improved Student Fetching:** Added a loop to `fetchAllStudents` method to ensure all students are added, even in classes larger than 30 students. (Closes #21)
*   **Explicit Auth Scopes:**  Added explicit auth scopes in `appscript.json` to address potential authorization issues. (#17)
*   **Repo Rename Updates**: Updated update URLs after repository rename.
*   **Version Bump**: Bumped version to v0.4.1

## 🐛 Bug Fixes

*   **Admin Sheet Validation:** Correctly validates whether the current sheet is an admin sheet, preventing the `Classrooms` sheet from being incorrectly created in assessment records.
*   **Image Upload URL:** Fixed `imageUploadUrl` generation in `Configuration Manager`. (Fixes #20)
*  **Loading State:** `UpdateManager` now deletes the Script property after successful loading.
*   **Admin Sheet Check:** Added an AdminSheet check to avoid instantiating `ClassroomSheetManager` incorrectly. (Fixes #16)

## 🤝 Merged Pull Requests

*   Merge pull request #22 from h-arnold:UpdateManager

## 📚 Sheet Copies

You can find copies of the sheets with the latest code in this Google Drive folder: [Google Drive Folder](https://drive.google.com/drive/folders/1V3PU0W1-D1rqGZ3ztmowcnk9HHM-taeK?usp=sharing)

## ⬆️ Updating to v0.4.1

If you already have Assessment Bot running, you can update to v0.4.1 by following these steps:

1.  Open your existing Admin Sheet.
2.  Click on **Assessment Bot** -> **Settings** -> **Update Version**.
3.  Select the **v0.4.1** option and follow the instructions.