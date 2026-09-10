# Pre-PR Review - feat/ScriptPropertiesAuthService

- **Base branch:** main
- **Generated:** 2026-09-10T17:32:25+00:00
- **Regression gate:** PASS (0 regressions; 0 new failures). The comparison still has 10 inherited backend `max-lines` lint failures.
- **Changed files:** 125 (13,802 insertions, 2,898 deletions)

## Verdict

**Fail** - four Critical findings and multiple Improvement findings remain across the authentication and settings change.

## Focus areas

### Repo rule compliance

#### Improvement

- `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:117` - `/last.?admin|admin must remain/i` cannot match the backend's `Auth Users must contain at least one admin.` message (`src/backend/ConfigurationManager/01_configKeysAndSchema.js:136`); the targeted last-admin copy is unreachable and the frontend classifies failures from prose rather than a structured contract.
- `src/backend/Utils/AuthService.js:101-143` and `src/backend/Utils/AuthSettingsDomain.js:47-98` - the access-resolution pipeline is duplicated despite the ACTION_PLAN shared-path intent; the copies already differ in options.
- `src/backend/ConfigurationManager/97_ConfigurationManagerLockedWrite.js:94` - `{ ...host.configCache, ...next }` can retain keys deleted by a future concurrent mutation rather than replacing the cache with the locked-write result.

#### Nitpick

- `src/backend/z_Api/apiAuth.js:54` - JSDoc says `authMode` is nullable although the documented and Zod transport contract is non-nullable.

#### Incidental (triage)

- `src/backend/z_Api/z_apiHandler.js:21` - the `FORBIDDEN` comment still says “not a group member”, but the envelope now also covers non-admin denial.

### KISS & DRY

#### Improvement

- `src/backend/Utils/AuthService.js:101-143`, `src/backend/Utils/AuthSettingsDomain.js:47-97`, and `AuthSettingsDomain.js:216` - identity normalisation, denial handling, audit strings, and provider selection are duplicated; use one access-resolution step.
- `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:108-130` - backend failure prose is regex-matched rather than mapped with a stable discriminator; wording changes silently select generic copy.
- `src/backend/ConfigurationManager/97_ConfigurationManagerLockedWrite.js:94` - the generic locked-write API cannot represent deletion while cache state is merge-only.

#### Nitpick

- `src/frontend/src/features/settings/authentication/AuthenticationSettingsTab.tsx:92` - dead `?? 'scriptProperties'` fallback.
- `src/frontend/src/features/auth/useStartupWarmupCycle.ts:166-174` - seven positional parameters including two bare booleans obscure call-site meaning.
- `src/backend/z_Api/apiConfig.js:20-65` - field names appear twice in each descriptor (`field` and `read` closure), permitting drift.
- `src/backend/z_Api/z_apiHandler.js:158` - `...(isAdminRequired ? { bypassCache: true } : {})` can be `bypassCache: isAdminRequired`.

#### Incidental (triage)

- `src/backend/ConfigurationManager/01_configKeysAndSchema.js:350-352` and `98_ConfigurationManagerClass.js:450-452` - `__CONFIG_MANAGER_STATICS_INITIALISED__` is written but never read.

### De-Sloppification

#### Critical

- `src/backend/ConfigurationManager/96_ConfigurationManagerStorage.js:59-74` - `readRawConfigString()` and `readConfig()` have no callers; equivalent read-and-parse logic is inlined in `98_ConfigurationManagerClass.js:85-87` and `97_ConfigurationManagerLockedWrite.js:76-77`. Wire the storage class in or remove it.
- `src/backend/Utils/AuthService.js:101-142` and `src/backend/Utils/AuthSettingsDomain.js:47-97` - unmarked duplicated deny pipeline violates the backend defence-in-depth duplication rule and drifts in claim-failure behaviour.
- `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:117` - last-admin mapping cannot match the only backend message and misses an ACTION_PLAN acceptance criterion.

#### Improvement

- `src/frontend/src/features/settings/authentication/AuthenticationSettingsTab.tsx:92` - unreachable default fallback.

#### Nitpick

- `src/backend/Utils/AuthService.js:136-142` - `neverClaim` is passed to providers that do not accept it.
- `src/backend/z_Api/z_apiHandler.js:21` - stale FORBIDDEN comment.
- `src/frontend/src/features/auth/useStartupWarmupCycle.ts:166-174` - replace positional boolean flags with readable options.

### Performance (Big-O)

#### Improvement

- `src/backend/Utils/AuthService.js:114` to `97_ConfigurationManagerLockedWrite.js:106-111` - every gated request invokes `isFreshInstall()`, adding a raw `PropertiesService` round-trip despite a populated cache proving the blob exists.
- `src/backend/ConfigurationManager/01_configKeysAndSchema.js:110-140,339` and `ScriptPropertiesAuthService.js:37-48` - script-properties access parses, validates, serialises, reparses, then searches the list: O(n) with roughly four passes over stored bytes per request.
- `src/backend/ConfigurationManager/97_ConfigurationManagerDefaults.js:42-49` - fresh-install seeding performs eight sequential locked blob writes rather than one staged batch.

#### Nitpick

- `src/frontend/src/features/settings/authentication/AuthenticationSettingsUserTable.tsx:70` - `users.map((user) => ({ ...user }))` allocates O(n) new rows on every render.

### Logging rules compliance

#### Improvement

- `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:108-130` - user-safe copy maps raw message text, not `error.code`, contrary to frontend policy.

#### Nitpick

- `src/backend/ConfigurationManager/97_ConfigurationManagerLockedWrite.js:62-73` - lock-contention handling drops the original `waitLock` error rather than preserving it as a cause.

#### Incidental (triage)

- `src/backend/z_Api/apiConfig.js:160-171` - staging failures log each error and then log the same errors in aggregate.

### Frontend layout / design / accessibility

#### Improvement

- `src/frontend/src/features/auth/AppAuthGate.tsx:59,86` - loading outputs omit `aria-busy="true"`; their labels duplicate visible text.
- `src/frontend/src/features/settings/authentication/AuthenticationSettingsTab.tsx:98,114,127` - `settings-tab-panel--authentication` has no CSS definition although the layout specification requires the corresponding narrow panel behaviour.
- `src/frontend/src/pages/SettingsPage.tsx:23-24` - optional `useContext(ApplicationAccessContext)?.role` hides the tab when context is absent instead of using the fail-loud helper.

#### Nitpick

- `src/frontend/src/features/settings/authentication/AuthenticationSettingsTab.tsx:92` - uninstructed dead default.
- `src/frontend/src/features/settings/authentication/AuthenticationSettingsTab.tsx:247-249` - return type permits `null`, but the component never returns it.

### Frontend data shape / schema consistency

#### Improvement

- `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:117` - last-admin message mismatch.
- `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:108-130` - missing-revision race message is not covered by the stale regex.
- `src/frontend/src/services/authService/authService.zod.ts:85-91` - request schema accepts a script-properties user list with zero admins, which the backend rejects.
- `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:108-130` - local blank-group Zod error is discarded by generic error mapping.

#### Nitpick

- `src/frontend/src/services/authService/authService.zod.ts:38` and `useAuthenticationSettings.ts:31` - `AuthUserRole` is declared twice.
- `src/frontend/src/features/settings/authentication/AuthenticationSettingsTab.tsx:92` - dead default.

### Backend data shape / schema consistency

#### Improvement

- `src/backend/Utils/AuthSettingsDomain.js:45-98` - duplicated access-resolution shape can drift from `AuthService`.
- `src/backend/ConfigurationManager/96_ConfigurationManagerStorage.js:59-73` - dead storage abstraction and defensive guard.

#### Nitpick

- `src/backend/ConfigurationManager/01_configKeysAndSchema.js:47` - `AUTH_USER_ALLOWED_KEYS` is unfrozen.
- `src/backend/ConfigurationManager/97_ConfigurationManagerLockedWrite.js:80` - an 8KB “bytes” limit is measured in UTF-16 code units.
- `src/backend/ConfigurationManager/01_configKeysAndSchema.js:152-164` - non-canonical revisions such as `007` are accepted.
- `src/backend/z_Api/apiAuth.js:70-71` - raw blob fields are read rather than typed getters.
- `src/backend/z_Api/apiAuth.js:93-100` - unknown backend request fields are silently ignored while the frontend schema is strict.

### Security & secrets

#### Improvement

- `src/backend/z_Api/z_apiHandler.js:143-147,224-230` - ungated debug request/response logs capture `setAuthenticationSettings` authorised-user email lists in GAS logs; redact this payload.

#### Incidental (triage)

- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js:117-143` - unknown keys are unvalidated and inherited keys can be returned; no current transport path exposes this.

#### Nitpick

- `src/backend/ConfigurationManager/01_configKeysAndSchema.js:311` - stored `authMode` is interpolated into an audit error.

### Test-coverage gaps

#### Critical

- `src/backend/Utils/AuthSettingsDomain.js:231-241` - no test covers a scriptProperties-to-googleGroups switch saving-admin check, including the required fresh GroupsApp OWNER/MANAGER allow and deny paths.

#### Improvement

- `src/backend/Utils/AuthSettingsDomain.js:70-76` - competing-writer fall-through is untested through `resolveApplicationAccess`.
- `src/backend/z_Api/apiAuth.js:93-98` - non-object settings payload rejection is untested.
- `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:125-127` - RATE_LIMITED save copy is untested.
- `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:307-313` - post-save revision rebase and a second save are untested.

#### Nitpick

- `src/backend/Utils/AuthSettingsDomain.js:190-198` - groups-mode blank/missing email save row is untested.

### Error-handling robustness

#### Improvement

- `src/backend/z_Api/apiConfig.js:180-191` - locked-write errors are flattened, losing `CONFIG_LOCK_CONTENTION` retry semantics and returning raw `error.message`.
- `src/backend/z_Api/apiConfig.js:157-173` - failures are logged twice.
- `src/backend/Utils/AuthService.js:291-307` - bootstrap-claim audit drops the raw thrown error.
- `src/backend/ConfigurationManager/96_ConfigurationManagerStorage.js:59-73` - dead storage guard masks a wiring error as absent configuration.
- `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:108-130` - error prose regex mapping.
- `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:315-322` - save failure has no developer diagnostic with request ID and error code.

### Data-shape docs consistency

#### Improvement

- `docs/developer/data-shapes/INDEX.md:67-68` - AuthUsers is described as planned despite the implemented status and canonical contract.
- `docs/developer/data-shapes/backend-config.md:280` - says 11 ordinary writable fields; the schema has 10.
- `docs/developer/data-shapes/backend-config.md:252-259,301` - describes the wrong validator/mechanism and stale clearing message for the once-set auth guard.
- `docs/developer/data-shapes/auth-cache.md:105-108,130-141` - attributes cache derivation and `_isGroupMember` to `AuthService` instead of `GoogleGroupsAuthService`.

#### Nitpick

- `docs/developer/data-shapes/auth-users.md:174` - groups mode wording ambiguously suggests it parses a retained users list.

## Decisions

### De-Sloppification

- **[Critical] `src/backend/ConfigurationManager/96_ConfigurationManagerStorage.js:59-74`** - Decision: Fix now. Approach: wire `readConfig()` into the facade and `readRawConfigString()` into the locked-write path so parsing has one owner. Rationale: the ACTION_PLAN assigns blob read/parse responsibility to this component.
- **[Critical] `src/backend/Utils/AuthService.js:101-142`; `src/backend/Utils/AuthSettingsDomain.js:47-97`** - Decision: Fix now. Approach: extract a shared access-resolution path, retaining and documenting any intentionally distinct claim-failure semantics. Rationale: duplicated security-path control flow has already diverged and violates the stated shared-path design.
- **[Critical] `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:117`; `src/backend/ConfigurationManager/01_configKeysAndSchema.js:136`** - Decision: Fix now. Approach: add stable backend API error codes, map frontend copy exclusively from `error.code`, and cover the last-admin case. Rationale: the present regex cannot match the emitted backend message.
- **[Nitpick] `src/backend/Utils/AuthService.js:136-142`** - Decision: Fix now. Approach: remove the unused `neverClaim` provider argument. Rationale: the current provider signatures do not consume it.
- **[Nitpick] `src/backend/z_Api/z_apiHandler.js:21`** - Decision: Fix now. Approach: update the FORBIDDEN comment to describe general authenticated non-admin denial. Rationale: the group-membership wording is stale.
- **[Incidental] `src/backend/ConfigurationManager/01_configKeysAndSchema.js:350-352`; `98_ConfigurationManagerClass.js:450-452`** - Decision: Fix now. Approach: remove the write-only `__CONFIG_MANAGER_STATICS_INITIALISED__` flag and its writes. Rationale: it has no readers.

### Test-coverage gaps

- **[Critical] `src/backend/Utils/AuthSettingsDomain.js:231-241`** - Decision: Fix now. Approach: add focused backend coverage for scriptProperties-to-googleGroups saves, including fresh GroupsApp OWNER/MANAGER allow and deny paths and cache-bypass behaviour. Rationale: this is a security-critical migration path.
- **[Improvement] `src/backend/Utils/AuthSettingsDomain.js:70-76`** - Decision: Fix now. Approach: add a focused gate-exempt endpoint-path test for competing-writer claim fall-through. Rationale: equivalent `checkAccess` coverage does not protect this separate path.
- **[Improvement] `src/backend/z_Api/apiAuth.js:93-98`** - Decision: Fix now. Approach: add a focused API test for non-object settings-payload rejection. Rationale: the new transport guard needs direct regression coverage.
- **[Improvement] `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:125-127`** - Decision: Fix now. Approach: add a component test in `AuthenticationSettingsTab.spec.tsx` for a RATE_LIMITED save failure and its user-visible busy/service copy. Rationale: the backend envelope is covered but the recovery UX is not.
- **[Improvement] `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:307-313`** - Decision: Fix now. Approach: add a consecutive-save test asserting that the rebased revision is sent on the next request. Rationale: a regression here can break subsequent legitimate saves.
- **[Nitpick] `src/backend/Utils/AuthSettingsDomain.js:190-198`** - Decision: Fix now. Approach: add a groups-mode save test for blank and missing `authGroupEmail`. Rationale: the validation seam is otherwise covered, and this completes its boundary matrix.
- **[Incidental] `src/backend/Utils/ScriptPropertiesAuthService.js:35-46`** - Decision: Fix now. Approach: remove the parse-failure catch unreachable after strict auth-state validation, rather than add dead-path tests. Rationale: unreachable defensive code obscures the real invariant.

### Repo rule compliance / KISS & DRY

- **[Improvement] `src/backend/ConfigurationManager/97_ConfigurationManagerLockedWrite.js:94`** - Decision: Fix now. Approach: replace the cache with the post-lock `next` result and cover deletion semantics as appropriate. Rationale: merge-only cache state violates the generic locked-write contract.
- **[Nitpick] `src/frontend/src/features/auth/useStartupWarmupCycle.ts:166-174`** - Decision: Fix now. Approach: replace the seven positional parameters with one named options object. Rationale: the two boolean arguments obscure call-site intent.
- **[Nitpick] `src/backend/z_Api/apiConfig.js:20-65`** - Decision: Fix now. Approach: derive each descriptor's read behaviour from a single field definition. Rationale: repeated literals can drift silently.
- **[Nitpick] `src/backend/z_Api/z_apiHandler.js:158`** - Decision: Fix now. Approach: use the direct `bypassCache: isAdminRequired` boolean property. Rationale: it is equivalent and easier to read.

### Security & secrets

- **[Improvement] `src/backend/z_Api/z_apiHandler.js:143-147,224-230`** - Decision: Fix now. Approach: omit request and response bodies for `setAuthenticationSettings` from debug logs. Rationale: GAS logs must not retain user-email lists unnecessarily.
- **[Nitpick] `src/backend/ConfigurationManager/01_configKeysAndSchema.js:311`** - Decision: Fix now. Approach: replace raw stored auth-mode interpolation with a constant invalid-stored-authentication-mode error message. Rationale: malformed manual or migrated storage content is an edge case, but no raw value is needed for diagnosis.
- **[Incidental] `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js:117-143`** - Decision: Fix now. Approach: harden generic configuration accessors to reject unvalidated unknown keys and inherited-key reads. Rationale: no current transport path reaches this, but generic accessor semantics should not expose latent unsafe behaviour.
- **[Incidental] same-mode scriptProperties self-removal** - Decision: Fix now (documentation only). Approach: retain the low-risk self-lockout behaviour and add documentation explaining how to manually edit Script Properties to restore an administrator. Rationale: recovery exists; a behavioural restriction is not justified, but the operational recovery route should be clear.

### Frontend data shape / Logging / Error handling

- **[Improvement] `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:108-130`** - Decision: Fix now. Approach: define documented backend error codes for stale revision, last-admin rejection, invalid candidate, and saving-admin denial; map user-safe frontend copy exclusively from `error.code`. Rationale: prose matching is brittle and leaves valid recovery paths generic.
- **[Improvement] `src/frontend/src/services/authService/authService.zod.ts:85-91`** - Decision: Fix now. Approach: require at least one administrator in the scriptProperties request schema and add focused coverage. Rationale: client and backend candidate invariants must agree.
- **[Improvement] `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:108-130`** - Decision: Fix now. Approach: preserve and render the targeted blank-group-email client validation message. Rationale: generic save copy discards actionable local validation feedback.
- **[Nitpick] `src/frontend/src/services/authService/authService.zod.ts:38`; `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:31`** - Decision: Fix now. Approach: reuse one canonical AuthUserRole definition. Rationale: duplicate aliases can drift.

### Frontend layout / design / accessibility

- **[Improvement] `src/frontend/src/features/auth/AppAuthGate.tsx:59,86`** - Decision: Fix now. Approach: add the documented `aria-busy` loading semantics and avoid duplicated accessible text. Rationale: current loading output does not meet the established accessibility standard.
- **[Improvement] `src/frontend/src/features/settings/authentication/AuthenticationSettingsTab.tsx:98,114,127`** - Decision: Fix now. Approach: add the intended `settings-tab-panel--authentication` CSS modifier using the existing backend narrow-panel pattern. Rationale: the approved layout requires this panel behaviour.
- **[Improvement] `src/frontend/src/pages/SettingsPage.tsx:23-24`** - Decision: Fix now. Approach: use the existing fail-loud application-access context helper. Rationale: a missing provider is a wiring error and should not silently suppress an admin surface.
- **[Nitpick] `src/frontend/src/features/settings/authentication/AuthenticationSettingsTab.tsx:92`** - Decision: Fix now. Approach: remove the unreachable uninstructed fallback and narrow the type through the existing ready gate. Rationale: it violates the defaults rule and cannot affect a valid render path.
- **[Nitpick] `src/frontend/src/features/settings/authentication/AuthenticationSettingsTab.tsx:247-249`** - Decision: Fix now. Approach: narrow the component return type to `ReactElement`. Rationale: its implementation never returns `null`.

### Performance (Big-O)

- **[Improvement] `src/backend/Utils/AuthService.js:114`** - Decision: Fix now. Approach: short-circuit the fresh-install probe when populated cached configuration proves a stored blob exists, while preserving fresh-install behaviour. Rationale: the current auth hot path makes an unnecessary PropertiesService round-trip.
- **[Improvement] `src/backend/ConfigurationManager/01_configKeysAndSchema.js:110-140,339`; `src/backend/Utils/ScriptPropertiesAuthService.js:37-48`** - Decision: Fix now. Approach: reuse the parsed users list returned by strict auth-state resolution; do not add a second memoisation layer. Rationale: this removes repeated work while keeping one validation authority.
- **[Improvement] `src/backend/ConfigurationManager/97_ConfigurationManagerDefaults.js:42-49`** - Decision: Fix now. Approach: stage default values and write them in one locked batch. Rationale: fresh installation should not perform eight serial full-blob transactions.
- **[Nitpick] `src/frontend/src/features/settings/authentication/AuthenticationSettingsUserTable.tsx:70`** - Decision: Fix now. Approach: pass the immutable users list directly so table rows can be reused during typing. Rationale: per-render row cloning is unnecessary allocation.

### Error-handling robustness

- **[Improvement] `src/backend/z_Api/apiConfig.js:180-191`** - Decision: Fix now. Approach: preserve typed locked-write contention errors for retriable API-envelope mapping, and never return raw error messages. Rationale: flattening loses rate-limit semantics and bypasses response hygiene.
- **[Improvement] `src/backend/z_Api/apiConfig.js:157-173`** - Decision: Fix now. Approach: retain one boundary log with complete context and remove the duplicate detail emission. Rationale: the policy requires log-once discipline.
- **[Improvement] `src/backend/Utils/AuthService.js:291-307`** - Decision: Fix now. Approach: preserve the original error as developer-only ABLogger context without exposing it in the user-facing envelope. Rationale: code-only logging impairs diagnosis.
- **[Improvement] `src/backend/ConfigurationManager/96_ConfigurationManagerStorage.js:59-73`** - Decision: Fix now. Approach: remove the masking defensive guard while wiring the storage abstraction into its callers. Rationale: known internal-module failures must fail loudly.
- **[Improvement] `src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts:315-322`** - Decision: Fix now. Approach: log a policy-compliant developer diagnostic at the hook boundary with request ID and error code, while preserving mapped user copy. Rationale: failure diagnosis presently lacks correlation data.
- **[Nitpick] `src/backend/ConfigurationManager/97_ConfigurationManagerLockedWrite.js:62-73`** - Decision: Fix now. Approach: retain the original `waitLock` error as typed failure context/cause. Rationale: replacement-only contention errors lose useful developer diagnostics.
- **[Incidental] `src/backend/RequestHandlers/LLMRequestManager.js:229,378,384`** - Decision: Fix later. Approach: raise a focused cleanup to replace pre-existing direct `console.warn` calls with the project logger. Rationale: the touched diff is comment-only and this unrelated refactor should not expand the authentication PR.
- **[Nitpick] `src/backend/Utils/AuthSettingsDomain.js:231-241`** - Decision: Fix now. Approach: distinguish a GroupsApp lookup/service failure from a genuine saving-admin role denial. Rationale: operators need accurate recovery semantics.
- **[Nitpick] `src/backend/Utils/AuthService.js:94,165,184`** - Decision: Wontfix. Rationale: current validation ownership is intentional; adding `Validate.requireParams` would duplicate the domain/transport validation boundary without a demonstrated defect.

### Data-shape docs consistency

- **[Improvement] `docs/developer/data-shapes/INDEX.md:67-68`** - Decision: Fix now. Approach: mark AuthUsers as implemented and reconcile the canonical documentation with the current contract. Rationale: its planned status contradicts the same index and the implemented `auth-users.md` contract.
- **[Improvement] `docs/developer/data-shapes/backend-config.md:280`** - Decision: Fix now. Approach: correct the ordinary frontend writable-field count to 10 and verify related field lists. Rationale: `revokeAuthTriggerSet` is backend-only.
- **[Improvement] `docs/developer/data-shapes/backend-config.md:252-259,301`** - Decision: Fix now. Approach: document the strict candidate-validation and locked-raw-write mechanism and replace the obsolete rejection message. Rationale: canonical documentation must describe the implemented guard accurately.
- **[Improvement] `docs/developer/data-shapes/auth-cache.md:105-108,130-141`** - Decision: Fix now. Approach: update cache-key and membership-helper ownership references to `GoogleGroupsAuthService`. Rationale: the file index and mechanism description are stale after the provider extraction.
- **[Nitpick] `docs/developer/data-shapes/auth-users.md:174`** - Decision: Fix now. Approach: clarify that Google Groups mode returns an empty script-properties users list and does not parse a retained list. Rationale: current wording is ambiguous.
- **[Incidental] `docs/developer/data-shapes/trigger-context.md:23`** - Decision: Fix now. Approach: document `neverClaim: true` in trigger authorisation context. Rationale: it ensures automated triggers deny unconfigured installs rather than bootstrapping the first administrator.
- **[Incidental] `docs/developer/data-shapes/backend-config.md:186,308`** - Decision: Fix now. Approach: update the API-key pattern to the current canonical contract. Rationale: stale validation documentation causes integration drift.
- **[Incidental] `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts:9`** - Decision: Fix now. Approach: enforce non-empty strings in `NonEmptyStringSchema`. Rationale: its name and canonical documentation already define the intended invariant.

### Backend data shape / schema consistency

- **[Nitpick] `src/backend/ConfigurationManager/01_configKeysAndSchema.js:47`** - Decision: Fix now. Approach: freeze the fixed schema-key allowlist. Rationale: a mutable allowlist weakens an otherwise fixed invariant.
- **[Incidental] `FREEZE_SINGLETONS` dormant freeze path** - Decision: Fix now. Approach: remove the dead flag and freeze path. Rationale: it is unused and incompatible with cache reassignment.
- **[Incidental] `getJsonDbLockTimeoutMs` getter clamp** - Decision: Fix now. Approach: align the getter minimum with the 30,000ms schema/documentation minimum. Rationale: a configuration value must have one effective contract.
- **[Nitpick] `src/backend/ConfigurationManager/97_ConfigurationManagerLockedWrite.js:80`** - Decision: Fix now. Approach: remove the auth-state 8KB size check entirely. Rationale: ordinary authorised-user lists are substantially below this size; the unlikely boundary case does not justify ongoing processing overhead or maintenance.
- **[Nitpick] `src/backend/ConfigurationManager/01_configKeysAndSchema.js:152-164`** - Decision: Fix now. Approach: require canonical positive-integer revision serialisation. Rationale: equivalent revision values should not persist in multiple textual forms.
- **[Nitpick] `src/backend/z_Api/apiAuth.js:70-71`** - Decision: Fix now. Approach: use the standard typed ConfigurationManager getters to fetch authentication settings values. Rationale: this preserves the established validation/accessor boundary without a meaningful performance cost.
- **[Nitpick] `src/backend/z_Api/apiAuth.js:93-100`** - Decision: Fix now. Approach: reject unknown authentication-settings request fields at the backend transport boundary. Rationale: backend and strict frontend request contracts should agree.

All review findings have recorded decisions. Implementation and verification remain required before this branch can pass pre-PR review.

## Implementation Direction

The following choices are resolved by existing repository rules, documented contracts, or the ACTION_PLAN. They are not implementation alternatives.

- **Storage ownership (`96_ConfigurationManagerStorage.js`)** - Wire `readConfig()` into `getAllConfigurations()` and `readRawConfigString()` into the locked-write path; do not delete the class. The ACTION_PLAN created this component for blob read/parse responsibility, and the backend decomposition rule requires the facade to delegate to its focused collaborators.
- **Shared access resolution (`AuthService` / `AuthSettingsDomain`)** - Put the one shared internal access-resolution pipeline in `AuthService`, the documented application-authorisation owner. `AuthSettingsDomain` should consume that narrow operation rather than duplicate identity, bootstrap, broken-state, and provider-selection logic. Keep endpoint-specific response shaping outside the shared path.
- **Authentication save errors** - Add stable, documented API error codes for stale revision, last-admin rejection, invalid candidate, and saving-admin denial; map frontend copy exclusively from `error.code`. This is required by the frontend logging/error policy, which identifies `error.code` as the user-message discriminator.
- **Configuration storage and cache** - Set `host.configCache = next` after a successful locked write. The locked write is the serialisation point and `next` is its authoritative post-mutation state; merging stale cache data violates that contract.
- **Authentication panel styling** - Add the missing `settings-tab-panel--authentication` CSS rule using the existing backend narrow-panel precedent. The approved authentication layout specifies this layout, so removing the class would discard required design intent.
- **Parsed auth users** - Have strict auth-state resolution return/reuse its parsed users list for `ScriptPropertiesAuthService`; do not add a second memoisation layer. This removes repeated parsing while retaining one validation authority and avoids cache invalidation state.
- **Fresh-install defaults** - Stage the complete initial configuration and commit it through one locked write, matching the existing atomic settings-write pattern.
- **Configuration descriptor fields** - Use each descriptor's existing `field` value as the single source for reads; do not retain duplicated field literals in closures.
- **Auth-settings debug logging** - Omit request/response bodies for `setAuthenticationSettings` from debug logs rather than redact individual nested fields. The payload is an authorised-user list, and omission is the simplest reliable PII control.
- **Non-empty schema contract** - Add the existing Zod non-empty constraint to `NonEmptyStringSchema`; do not rename it or weaken documentation. Its name and canonical data-shape documentation already define the intended invariant.
- **Dormant features and unreachable catches** - Remove `FREEZE_SINGLETONS`, `__CONFIG_MANAGER_STATICS_INITIALISED__`, and the unreachable Script Properties parse catch. KISS and the backend defensive-guard policy favour deletion over repairing unused paths.
- **Generic configuration access** - Reject unknown keys using own-property schema checks, and read only own configuration properties. This preserves the existing allowlist model and prevents inherited-property behaviour.
- **GroupsApp saving-admin failures** - Represent an external lookup failure separately from a non-admin result, then map it at the API boundary as a retriable service failure. This preserves fail-closed access while giving operators an accurate recovery signal.
- **Documentation-only self-lockout item** - Do not prevent an administrator from removing themselves when another administrator remains. Update the accepted-risk/recovery documentation with the Script Properties restoration procedure, as explicitly decided.
- **Warm-up outcome helper** - Replace the seven positional parameters with one named options object. Rationale: this exposes the two boolean flags and state handles at each call site without introducing multiple single-use helpers.
