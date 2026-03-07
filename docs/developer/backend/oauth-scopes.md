# Managing OAuth Scopes

The source of truth for Google Apps Script OAuth scopes lives in `src/AdminSheet/appsscript.json`, which is part of the deprecated reference implementation.

Do not rely on sync tooling for this deprecated area. If legacy scope updates are ever required, they must be made explicitly and reviewed as direct file changes in the legacy files.
