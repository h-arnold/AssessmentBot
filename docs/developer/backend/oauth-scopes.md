# Managing OAuth Scopes

The source of truth for Google Apps Script OAuth scopes lives in `src/backend/appsscript.json`. The backend manifest is the canonical scope source.

When backend behaviour requires new scopes or services, update `src/backend/appsscript.json` and keep additions minimal and justified. The builder manifest merge process uses the backend manifest as its base.

For the current list of required scopes, see the `oauthScopes` array in `src/backend/appsscript.json`.
