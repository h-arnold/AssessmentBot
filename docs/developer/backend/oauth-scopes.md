# Managing OAuth Scopes

The source of truth for Google Apps Script OAuth scopes lives in `src/backend/appsscript.json`. The backend manifest is the canonical scope source.

When backend behaviour requires new scopes or services, update `src/backend/appsscript.json` and keep additions minimal and justified. The builder manifest merge process uses the backend manifest as its base.

For the current list of required scopes, see the `oauthScopes` array in `src/backend/appsscript.json`.

The Auth Service adds the Google Groups membership scope (`groups`) and active-user email scope
(`userinfo.email`). The manifest also requires `webapp.executeAs: USER_ACCESSING` and
`webapp.access: DOMAIN`; this deployment mode requires a Google Workspace domain. Keep
`src/backend/appsscript.json` as the canonical source rather than duplicating the full scope list.
