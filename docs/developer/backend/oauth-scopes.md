# Managing OAuth Scopes

The source of truth for Google Apps Script OAuth scopes lives in `src/AdminSheet/appsscript.json`. Add, remove, or reorder scopes inside the `oauthScopes` array in that file whenever the AdminSheet needs additional permissions.

Once the AdminSheet configuration is updated, run `node scripts/sync-appsscript.js` (or rely on the Husky pre-commit hook) to mirror the scopes everywhere else they are required. The sync script copies the entire AdminSheet `appsscript.json` into the Assessment Record Template and rewrites `TriggerController.REQUIRED_SCOPES` so that the Apps Script triggers request the same permissions.

Never edit scopes directly in `src/AssessmentRecordTemplate/appsscript.json` or `src/AdminSheet/Utils/TriggerController.js`; those files are generated artefacts and will be overwritten by the sync script.
