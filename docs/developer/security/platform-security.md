# Google Apps Script Platform Security

This document is **Layer 1** of the AssessmentBot security approach (see the
[security overview](./README.md) for the full layering model). It covers the Google Apps
Script (GAS) platform controls that govern _who can invoke the web app_, _with whose
identity and authorisation the script runs_, and _how data is exposed through Drive and
scheduled execution_. Layer 1 is the **primary control**: it is sufficient on its own
when correctly configured. Layers 2–4 exist as defence in depth for the cases where
misconfiguration happens, the deployed surface is larger than the UI, or data should not
exist where it does not have to.

## Deployment configuration

The deployment block in the backend manifest (`src/backend/appsscript.json`) pins the two
settings that define the platform security posture:

```json
"webapp": {
  "executeAs": "USER_ACCESSING",
  "access": "DOMAIN"
}
```

- **`executeAs: USER_ACCESSING`** — every script invocation runs with the **calling
  user's** identity and authorisation, not the deployer's. This is least privilege by
  construction: the script can only do what the signed-in user can do, so a user cannot
  reach data (Drive folders, Classroom courses, Sheets) that their own account could not
  reach. The alternative — `executeAs: USER_DEPLOYING` ("execute as me") — would run every
  request with the deployer's full authority, making the web app a universal impersonation
  channel.
- **`access: DOMAIN`** — only signed-in users in the Google Workspace domain can open the
  web app; **anonymous access is blocked**. Anyone outside the organisation (or without a
  signed-in Workspace identity) cannot reach the `doGet` entrypoint
  (`src/backend/z_Api/WebApp.js`) at all.

### Identity model

The pairing matters because it is what makes `Session.getActiveUser().getEmail()` return
the signed-in user's email — the identity used by Layer 2's `AuthService` gate. When the
web app runs "as the user accessing" it and only domain members can reach it, GAS
resolves the active user to the signed-in domain account rather than the deployer or an
empty string. This was verified against the official Apps Script `Session` reference
during planning (see `SPEC.md`, decision 2): a deployment that used `USER_DEPLOYING`, or
allowed anonymous access, could yield the deployer's identity or a blank email and would
break the entire application authentication model.

The identity model has one hard prerequisite: **`access: DOMAIN` is only valid within a
Google Workspace domain**. A deployment on a personal (Gmail) identity cannot use `DOMAIN`
access; in that case the appropriate `access` value must be confirmed with the deploying
administrator before rollout (recorded as an explicit assumption in `SPEC.md`, decision
R5, and in `src/backend/AGENTS.md` §2.5).

The builder's manifest merge uses `src/backend/appsscript.json` as its base, so the
`webapp` block (and the OAuth scopes below) flow unchanged into the deployed
`build/gas/appsscript.json` (see [builder-script.md](../builder/builder-script.md), Stage 8).

> **Recommended operational practice.** After deploying, verify the deployment's _Execute
> as_ and _Who has access_ settings in the Apps Script deployment UI. These can be changed
> there independently of the manifest, so a manual change or an editor's mistake can
> silently downgrade the deployment (e.g. to "execute as me" or "anyone"). Whenever the
> manifest's `webapp` block changes, redeploy the app; editing the manifest alone does not
> update an existing deployment.

## OAuth scope minimisation

`src/backend/appsscript.json` is the canonical source for the script's OAuth scopes; the
scope-management process is documented in
[oauth-scopes.md](../backend/oauth-scopes.md) and is not duplicated here. The current
`oauthScopes` array (see the manifest) follows a minimisation policy:

- **Classroom access uses readonly variants** (`classroom.courses.readonly`,
  `classroom.rosters.readonly`, `classroom.coursework.students.readonly`,
  `classroom.topics.readonly`, `classroom.profile.emails`, `classroom.profile.photos`).
  These were tightened in v0.7.7, which switched the Classroom scopes from their
  read-write variants to match the read-only permissions the hosted script actually
  needs (see [v0.7.7 release notes](../../releaseNotes/v0.7.7_release_notes.md)).
- The `groups` scope (Google Groups membership lookups) and `userinfo.email` scope
  (active-user email resolution) were added for the auth service (Layer 2).
- The advanced services enabled are limited to what the application uses: Sheets (v4),
  Classroom (v1), Slides (v1) and Drive (v3).

Scope minimisation is enforced in two places:

1. **The manifest** — the only place a new scope should ever be introduced (per
   [oauth-scopes.md](../backend/oauth-scopes.md)).
2. **Trigger creation** — `TriggerController.REQUIRED_SCOPES`
   (`src/backend/Triggers/TriggerController.js`) mirrors the manifest's `oauthScopes`
   array element for element, and `createTimeBasedTrigger` calls
   `ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, TriggerController.REQUIRED_SCOPES)`
   before creating a trigger. The comment on the constant states that the two lists must
   be kept in sync manually.

The reason triggers demand the same authorisation surface is that **installable triggers
run under the creating user's account with that user's granted authorisation** (see the
trigger section below). If the scope set demanded at trigger-creation time were narrower
than the web app's, a scheduled job could execute with a different (or missing)
authorisation than the user granted for interactive use; `requireScopes` makes the
authorisation surface explicit and fails the trigger creation if the user has not granted
it.

**Users must re-authorise the app when scopes change.** Google requires a fresh consent
for newly added scopes; until then the affected services are unavailable. The auth-service
rollout required exactly this: redeploying after the `groups` and `userinfo.email` scopes
were added, with users re-authorising on next access (see the rollout steps in `SPEC.md`).

> **Recommended operational practice.** Keep scope additions minimal and justified — add a
> scope only when the code genuinely requires it, and prefer readonly variants wherever
> possible. Review the `oauthScopes` array on every manifest change, and confirm the
> `TriggerController.REQUIRED_SCOPES` list has been updated in lockstep.

## Drive file and folder permissions

Assessment records live in Google Sheets/Drive and student work lives in Drive, so the
permissions on those Drive objects are the platform-layer control protecting the data.
`src/backend/GoogleDriveManager/DriveManager.js` is the module that manipulates those
objects, and its sharing model is deliberately narrow:

- **`shareFolder(destinationFolderId, emails)`** shares a destination folder with named
  individuals by calling `destinationFolder.addEditor(email)` for each address. There is
  no code path that grants "anyone with the link" access — no `addViewer`/link-sharing
  variant exists anywhere in the module.
- **`_validateFolderExists(folderId)`** verifies a folder exists and is accessible via
  the Advanced Drive API (`Drive.Files.get(folderId, { supportsAllDrives: true, fields:
'id' })`) and throws a user-facing error otherwise. Every folder operation that moves
  or copies data validates its destination first (fail fast).
- **`copyTemplateSheet(...)`** and the move operations use the Advanced Drive API with
  `supportsAllDrives: true`, because — as the code comment at `copyTemplateSheet` notes —
  `DriveApp.getFolderById` and folder iterators **can fail in Shared Drive contexts**.
  The module deliberately avoids the `DriveApp` parent-manipulation paths
  (`removeFile`/`addFile`) that are unreliable for Shared Drives, and falls back to the
  Advanced Drive API when a `DriveApp` folder operation fails (see `createFolder`).

The security consequence: when the application shares or creates assessment data, the
granularity of access is the **named individual**, not the link. Anyone who can reach a
shared folder has been explicitly listed by an authorised operator. If that folder is in
a Shared Drive, the same least-privilege principle applies through the organisation's
Drive-level access model.

> **Recommended operational practice.** Keep folder sharing restricted to named
> individuals and apply least privilege: grant editors only the users who need to work in
> the folder. Review sharing on assessment-data folders regularly (Drive's "Manage
> access" panel) and remove users who leave the team or change role. Never use
> link-sharing ("anyone with the link") for assessment data or student work. Note that
> the code enforces named-individual sharing at the moment it shares; it cannot prevent
> an operator from later broadening access through the Drive UI, which is why periodic
> review matters.

## Trigger execution model

Scheduled assessment runs are implemented as installable time-based triggers. The
security-relevant property of the GAS trigger model is that **an installable trigger runs
under the account of the user who created it, with that user's authorisation**. Scheduled
work therefore inherits the creating user's identity and can only do what that user can
do — the same least-privilege principle as the web app, with the same consequence: a
trigger can never reach data the creating user could not reach.

Two mechanisms tie trigger execution back to the rest of the security model:

- **Authorisation at creation.** `TriggerController.createTimeBasedTrigger` calls
  `ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, TriggerController.REQUIRED_SCOPES)`
  before creating the trigger (see the scope section above), so the trigger is installed
  only with the full, granted authorisation surface.
- **A single funnel for execution.** All scheduled work funnels through one public
  entrypoint, `triggerHandler` (`src/backend/Triggers/triggerHandler.js`); the legacy
  per-task wrapper (`triggerProcessSelectedAssignment`) has been removed. `triggerHandler`
  performs validate-then-dispatch and owns all cleanup: for a resolved `triggerUid` it
  clears the stored context (`TriggerController.clearTriggerContext`) and deletes the
  fired trigger (`TriggerController.deleteTriggerById`) even when the handler throws. Its
  fail-closed authorisation behaviour (cache bypass, group required) is the subject of
  Layer 2's [application-authentication.md](./application-authentication.md); this layer
  only needs to record that every scheduled execution crosses the same auth gate as the
  API and that fired triggers are deleted so they cannot accumulate or be replayed.

> **Recommended operational practice.** When the trigger handler model changes, drain and
> replace old triggers before deploying: triggers installed by previous versions point at
> the old entrypoint (`triggerProcessSelectedAssignment`) and will fail or run stale code
> once it is removed. This migration is documented in the v0.7.6/v0.7.7 rollout steps in
> `SPEC.md`. Because triggers inherit their creator's identity, an operator who leaves the
> organisation should have their scheduled triggers reviewed and re-created under a
> remaining authorised user.

## Related documentation

- [Security Approach — overview](./README.md) — the layering model and threat model this
  document sits within.
- [Application-level authentication](./application-authentication.md) — Layer 2: the
  `AuthService` group-membership gate that re-authorises every API call and trigger
  execution.
- [Accepted risks and trade-offs](./accepted-risks.md) — risks accepted at the platform
  layer (e.g. revocation latency, bootstrap fail-open) and the reasoning behind them.
- [Managing OAuth scopes](../backend/oauth-scopes.md) — canonical scope-management
  process; `src/backend/appsscript.json` is the source of truth.
- [Data shapes INDEX](../data-shapes/INDEX.md) — canonical contracts, including
  [TriggerContext](../data-shapes/trigger-context.md) (the Script Properties trigger
  store) and [AuthCache](../data-shapes/auth-cache.md).
- [Builder script](../builder/builder-script.md) — Stage 8 covers the manifest merge that
  carries the `webapp` block and `oauthScopes` into the deployed bundle.
