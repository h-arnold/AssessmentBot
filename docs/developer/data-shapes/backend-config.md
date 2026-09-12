# Contract: BackendConfig

Singleton configuration store for backend behaviour, exposed to the frontend settings UI
via read and write endpoints.

Backend model: `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js` — singleton (not a Model with `toJSON()`)
Collections: None — persisted as a single JSON blob in script properties via `PropertiesService.getScriptProperties()` under key `__CONFIG_STORE_KEY__`
API handlers: `src/backend/z_Api/apiConfig.js`
Response mapper: None — `getBackendConfig_()` directly shapes data from `ConfigurationManager` methods
Frontend service: `src/frontend/src/services/backendConfiguration/backendConfigurationService.ts`
Frontend Zod: `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`

Sibling contracts:

- [Contract: ABClass](abclass.md) — No direct relationship.
- [Contract: AssignmentDefinition](assignment-definition.md) — No direct relationship.
- [Contract: Assignment](assignment.md) — No direct relationship.
- [Contract: Reference Data](reference-data.md) — No direct relationship.

> **Planned changes — all implemented** (SPEC.md v1.3, Application Authentication &
> Minimal Role Administration). The auth fields left the BackendConfig contract in
> lockstep across backend transport (Sections 2/6), frontend Zod schemas (Section 7),
> and the form schema/mapper/settings panel (Section 8). The contract below documents
> the reconciled 12 non-auth field shape; auth state is owned by the dedicated auth
> endpoints — see [Contract: AuthUsers](auth-users.md).

---

## Persistence

BackendConfig has no model class with `toJSON()`. Configuration is managed by the
`ConfigurationManager` singleton, which reads/writes a single JSON blob from
`PropertiesService.getScriptProperties()` under the key `__CONFIG_STORE_KEY__`.

All stored values are serialised as strings via `String(normalizedValue)` before being
written into the JSON blob. When read back, typed getter methods (e.g.
`getBackendAssessorBatchSize()`) convert from strings to the expected types. The transport
layer calls these typed getters and returns properly-typed values.

All persistent writes now serialise through `ConfigurationManager.writeConfigurationLocked(mutator)`
(implemented in ACTION_PLAN.md Section 2). The facade's
`setProperty()` and every typed `set*` method delegate to this single path. Under the shared
script-wide `LockService.getScriptLock()` — the **same** lock the vendored JsonDbApp
`DbLockService` uses (GAS script locks are **not reentrant**) — the path re-reads the raw
`__CONFIG_STORE_KEY__` blob from storage (never the in-memory `configCache`), runs the mutator to
produce the next config and merges it, checks the serialised blob against `MAX_CONFIG_BLOB_BYTES`
(8192) **before** the single `setProperty` write, and releases the lock in a `finally` block.
Contention throws an error with `code: 'CONFIG_LOCK_CONTENTION'` and `retriable: true`; an over-cap
blob throws `code: 'CONFIG_BLOB_TOO_LARGE'` and `retriable: false`. Callers must never invoke a
configuration write while a DB operation already holds the script lock (a caller-discipline rule the
write path does not detect). The freshness probe `isFreshInstall()` runs `ensureInitialized()` then
reads raw Script Properties for `__CONFIG_STORE_KEY__` absence (never the forgiving cache).

The `ensureDefaultConfiguration()` method seeds defaultable fields on first boot if no
prior configuration exists. Notable fields that are **not** seeded during initialisation:
`apiKey`, `backendUrl`, `jsonDbRootFolderId`, and `authGroupEmail` are excluded from `ensureDefaultConfiguration()` seeding. Adding
`AUTH_GROUP_EMAIL: ''` to `02_defaults.js` does **not** seed it — seeding runs via eight
explicit setters only, and the `DEFAULTS` entry supplies the getter fallback only, not a
seeded property.

| #   | Field                      | Stored type                        | Persistence                                                       | Transport                                                                                                                                                 | Frontend Zod                                                                                             | Notes                                                                                                                                                                                                                                                                                        |
| --- | -------------------------- | ---------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `backendAssessorBatchSize` | `string` (number stored as string) | Always included                                                   | `number` — parsed via `getIntConfig()`                                                                                                                    | `z.number().int()`                                                                                       | Default 120. Clamped to [1, 500].                                                                                                                                                                                                                                                            |
| 2   | `apiKey`                   | `string`                           | Always included                                                   | `string` — masked via `maskApiKey_()`                                                                                                                     | `MaskedApiKeySchema` — `z.string().refine(isMaskedBackendApiKeyValue)`                                   | Never raw stored value in transport. Empty string when no key stored. See [$transport-masking](#transport) for mask shapes.                                                                                                                                                                  |
| 3   | `hasApiKey`                | `boolean\|string`                  | Not stored directly; derived at transport time from `!!rawApiKey` | `boolean` — `!!rawApiKey`                                                                                                                                 | `z.boolean()`                                                                                            | Computed at transport boundary, not persisted.                                                                                                                                                                                                                                               |
| 4   | `backendUrl`               | `string`                           | Always included                                                   | `string` — may be empty                                                                                                                                   | `BackendUrlSchema` — `z.union([z.url(), z.literal('')])`                                                 | Empty string when unset. Read transport allows blank; write requires valid URL.                                                                                                                                                                                                              |
| 5   | `revokeAuthTriggerSet`     | `string` (`'true'` / `'false'`)    | Always included                                                   | `boolean` — via `ConfigurationManager.toBoolean()`                                                                                                        | `z.boolean()`                                                                                            | Treated as read-only by frontend (not in write input schema).                                                                                                                                                                                                                                |
| 6   | `daysUntilAuthRevoke`      | `string` (number stored as string) | Always included                                                   | `number` — parsed via `getIntConfig()`                                                                                                                    | `z.number().int()`                                                                                       | Default 60. Clamped to [1, 365].                                                                                                                                                                                                                                                             |
| 7   | `slidesFetchBatchSize`     | `string` (number stored as string) | Always included                                                   | `number` — parsed via `getIntConfig()`                                                                                                                    | `z.number().int()`                                                                                       | Default 30. Clamped to [1, 100].                                                                                                                                                                                                                                                             |
| 8   | `jsonDbMasterIndexKey`     | `string`                           | Always included                                                   | `string` — returns default if stored value is empty                                                                                                       | `NonEmptyStringSchema` (`z.string().min(1)`)                                                             | Default `'ASSESSMENT_BOT_DB_MASTER_INDEX'`.                                                                                                                                                                                                                                                  |
| 9   | `jsonDbLockTimeoutMs`      | `string` (number stored as string) | Always included                                                   | `number` — parsed via `getIntConfig()`                                                                                                                    | `z.number().int()`                                                                                       | Default 30000. Clamped to [30000, 600000].                                                                                                                                                                                                                                                   |
| 10  | `jsonDbLogLevel`           | `string`                           | Always included                                                   | `string` — trimmed and uppercased by getter                                                                                                               | `NonEmptyStringSchema` (`z.string().min(1)`)                                                             | Default `'INFO'`. Valid levels: `DEBUG`, `INFO`, `WARN`, `ERROR`.                                                                                                                                                                                                                            |
| 11  | `jsonDbBackupOnInitialise` | `string` (`'true'` / `'false'`)    | Always included                                                   | `boolean` — via `ConfigurationManager.toBoolean()`                                                                                                        | `z.boolean()`                                                                                            | Default `false`.                                                                                                                                                                                                                                                                             |
| 12  | `jsonDbRootFolderId`       | `string`                           | Always included                                                   | `string` — coerced to `''` when blank/null                                                                                                                | `z.string()`                                                                                             | May be empty string when unset. Transport normalises `null` → `''`.                                                                                                                                                                                                                          |
| 13  | `authGroupEmail`           | `string`                           | Always included                                                   | Omitted — managed via dedicated auth endpoints (see [Contract: AuthUsers](auth-users.md)); `getAuthGroupEmail()` still exists for the auth gate/bootstrap | Absent from the BackendConfig Zod schemas and the settings form (frontend lockstep landed, Sections 7–8) | Stored in the blob but absent from the BackendConfig transport. Blank when unset. In `googleGroups` mode the candidate validator requires a non-blank, valid email; the `CONFIG_SCHEMA` once-set guard is unreached from any transport (see the auth-save mechanism in the write key notes). |
| 14  | `authMode`                 | `string`                           | Always included                                                   | Omitted — managed via dedicated auth endpoints (see [Contract: AuthUsers](auth-users.md))                                                                 | Absent from the BackendConfig Zod schemas and the settings form (frontend lockstep landed, Sections 7–8) | `'none'` is removed and rejected (unrecognised mode → fail closed). Absent `authMode` with a non-blank `authGroupEmail` reads as `googleGroups` (legacy leniency). Auth fields leave the BackendConfig transport (Section 6 landed).                                                         |

Key notes:

- All configuration writes route through `writeConfigurationLocked(mutator)`; the shared script-wide
  lock, raw re-read/merge/single write, and the 8KB cap (`MAX_CONFIG_BLOB_BYTES`, 8192) are enforced
  on every write. Contention yields `CONFIG_LOCK_CONTENTION` (retriable); an over-cap blob yields
  `CONFIG_BLOB_TOO_LARGE` (non-retriable).
- All values are stored as strings in the JSON blob. Typed getters convert on read.
- The locked write path is a **persistence-layer** contract. `setBackendConfig_()` stages every
  supplied ordinary field through the manager-owned `preparePropertyValue` seam and commits the whole
  patch through one `writeConfigurationLocked` call — under the lock the raw blob is re-read, merged,
  and written once, so a concurrent writer's changes are preserved (no clobber). The former per-field
  unlocked write loop is removed (ACTION_PLAN.md Section 6).
- Locked-write contention is mapped to the typed retriable transport envelope (remediation batch):
  `commitBackendConfigPatch_()` catches `code: 'CONFIG_LOCK_CONTENTION'` and rethrows it as an
  `ApiRateLimitError`, which the dispatcher maps to the retriable `RATE_LIMITED` code. A locked write
  failure that is **not** contention (e.g. `CONFIG_BLOB_TOO_LARGE`) is still folded into the aggregate
  `{ success: false, error }` string, which carries neither the `code` nor the `retriable` flag (see
  discrepancy #10).
- `hasApiKey` is not a stored field; it is derived at transport time from `!!rawApiKey`.
- `apiKey`, `backendUrl`, `jsonDbRootFolderId`, and `authGroupEmail` are excluded from `ensureDefaultConfiguration()` seeding. Adding
  `AUTH_GROUP_EMAIL: ''` to `02_defaults.js` does **not** seed it — seeding runs via eight
  explicit setters only, and the `DEFAULTS` entry supplies the getter fallback only, not a
  seeded property.
- `jsonDbRootFolderId` normalisation: `configManager.getJsonDbRootFolderId() || ''` ensures the transport always returns a string.
- `authGroupEmail` normalisation: `configManager.getAuthGroupEmail() || ''` returns a string when
  the value is unset or blank. This getter is used by the auth gate / access-resolution path, not by
  `getBackendConfig` — the BackendConfig read transport no longer emits `authGroupEmail` (Section 6
  landed).

---

## Transport

### `getBackendConfig` (read)

Returns the full typed configuration object.

| Aspect           | Detail                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Backend handler  | `src/backend/z_Api/apiConfig.js` → `getBackendConfig_()`                                               |
| Controller       | — (ConfigurationManager singleton called directly)                                                     |
| Response mapper  | — (handler shapes the response inline)                                                                 |
| Frontend Zod     | `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts` → `BackendConfigSchema`   |
| Frontend service | `src/frontend/src/services/backendConfiguration/backendConfigurationService.ts` → `getBackendConfig()` |

**Request:** No parameters.

**Response:** `BackendConfigSchema`

| Field                      | Type                    | Required | Notes                                        |
| -------------------------- | ----------------------- | -------- | -------------------------------------------- |
| `backendAssessorBatchSize` | `number`                | yes      | Integer. Default 120.                        |
| `apiKey`                   | `string`                | yes      | Masked value. See masking contract below.    |
| `hasApiKey`                | `boolean`               | yes      | `true` when a raw API key exists in storage. |
| `backendUrl`               | `string` (URL \| empty) | yes      | May be empty string when unset.              |
| `revokeAuthTriggerSet`     | `boolean`               | yes      |                                              |
| `daysUntilAuthRevoke`      | `number`                | yes      | Integer. Default 60.                         |
| `slidesFetchBatchSize`     | `number`                | yes      | Integer. Default 30.                         |
| `jsonDbMasterIndexKey`     | `string`                | yes      |                                              |
| `jsonDbLockTimeoutMs`      | `number`                | yes      | Integer. Default 30000.                      |
| `jsonDbLogLevel`           | `string`                | yes      | One of `DEBUG`, `INFO`, `WARN`, `ERROR`.     |
| `jsonDbBackupOnInitialise` | `boolean`               | yes      |                                              |
| `jsonDbRootFolderId`       | `string`                | yes      | May be empty string when unset.              |

Key contract notes:

- The handler calls `configManager.ensureDefaultConfiguration()` first, which seeds
  defaultable fields on first boot. After seeding, it builds the response from typed getters.
- **API key masking contract** (`maskApiKey_()`):
  - No key stored → `''` (empty string)
  - Key length ≤ 4 chars → `'****'`
  - Key length > 4 chars → `'****'` + last 4 characters (e.g. `'****7890'`)
- `jsonDbRootFolderId` normalisation: `configManager.getJsonDbRootFolderId() || ''` produces
  empty string when the stored value is `null` (the default) or blank.
- **Frontend `.strict()` lockstep:** `BackendConfigSchema` uses
  `.strict()`, so the deploy-order constraint is asymmetric: the backend must not emit a field
  the frontend schema does not yet accept (an unknown key under `.strict()` rejects the whole
  read). The canonical read contract is exactly the 12 non-auth fields documented in the table
  above; `authGroupEmail` and `authMode` no longer appear in the response (Section 6 landed), so
  the earlier auth-field deploy-order tolerance in discrepancies #7/#8 is moot.
- The handler does **not** call `DateUtils.deepConvertDates()` because no config values
  are `Date` objects.
- The response is plain object shaped inline, not derived from a model's `toJSON()`.
- The frontend schema adds an optional `loadError?: string` field (not in backend response)
  which is populated client-side when the API call fails partially. This is outside the
  transport contract but present in the Zod schema for error-surface handling.

### `setBackendConfig` (write)

Accepts a partial patch: only supplied fields are written. Omitted fields are left unchanged.

| Aspect           | Detail                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend handler  | `src/backend/z_Api/apiConfig.js` → `setBackendConfig_()`                                                                                         |
| Controller       | — (ConfigurationManager singleton called directly)                                                                                               |
| Response mapper  | — (handler returns the save result inline)                                                                                                       |
| Frontend Zod     | `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts` → `BackendConfigWriteInputSchema`, `BackendConfigWriteResultSchema` |
| Frontend service | `src/frontend/src/services/backendConfiguration/backendConfigurationService.ts` → `setBackendConfig()`                                           |

**Request:**

| Field                      | Type           | Required | Notes                                                                                                                                                                                                                    |
| -------------------------- | -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backendAssessorBatchSize` | `number`       | no       | Must be integer 1–500.                                                                                                                                                                                                   |
| `apiKey`                   | `string`       | no       | Validated against `API_KEY_PATTERN` (alphanumeric prefix, underscore, exactly 32 base64url characters). Explicit empty string clears the stored key.                                                                     |
| `backendUrl`               | `string` (URL) | no       | Must be a valid URL.                                                                                                                                                                                                     |
| `daysUntilAuthRevoke`      | `number`       | no       | Must be integer 1–365.                                                                                                                                                                                                   |
| `slidesFetchBatchSize`     | `number`       | no       | Must be integer 1–100.                                                                                                                                                                                                   |
| `jsonDbMasterIndexKey`     | `string`       | no       | Non-empty string.                                                                                                                                                                                                        |
| `jsonDbLockTimeoutMs`      | `number`       | no       | Must be integer 30000–600000.                                                                                                                                                                                            |
| `jsonDbLogLevel`           | `string`       | no       | One of `DEBUG`, `INFO`, `WARN`, `ERROR`.                                                                                                                                                                                 |
| `jsonDbBackupOnInitialise` | `boolean`      | no       |                                                                                                                                                                                                                          |
| `jsonDbRootFolderId`       | `string`       | no       | Must be a valid Google Drive folder ID (alphanumeric, underscores, hyphens; minimum 10 chars) _as validated by the backend's `isValidGoogleDriveFolderId` which also verifies existence via `DriveApp.getFolderById()`_. |

**Request validation notes:**

- `params` must be a plain object; `ApiValidationError` is thrown otherwise.
- **Auth fields are rejected for every caller.** `setBackendConfig_()` checks the incoming
  payload for `authMode`, `authGroupEmail`, `authUsers`, and `authRevision` and throws an
  `ApiValidationError` (`INVALID_REQUEST` envelope) as a single request-shape violation the
  moment any of them is present — before any ordinary field is staged. Auth state is owned
  exclusively by the dedicated auth endpoints (see [Contract: AuthUsers](auth-users.md)).
- Each supplied **ordinary** field whose `value !== undefined` is validated/normalised through
  `ConfigurationManager.preparePropertyValue()` and staged; the whole patch is then committed
  through one `writeConfigurationLocked` call (see Persistence key notes).
- The frontend `BackendConfigWriteInputSchema` uses `.strict()` — fields outside the schema
  are silently stripped before the request reaches the backend.
- The writable ordinary field set in the backend is the **superset** of all 11 writable fields
  (10 documented in the table above + `revokeAuthTriggerSet`; the frontend schema intentionally
  excludes `revokeAuthTriggerSet`). The four auth fields are not part of this set — they are
  rejected outright.

**Response:** `BackendConfigWriteResultSchema` — a discriminated union:

| Shape   | `success` | Additional fields                                                   |
| ------- | --------- | ------------------------------------------------------------------- |
| Success | `true`    | —                                                                   |
| Failure | `false`   | `error: string` — aggregate error message without raw secret values |

Example success:

```json
{ "success": true }
```

Example failure:

```json
{
  "success": false,
  "error": "Failed to save some configuration values: apiKey: API Key must be an alphanumeric prefix followed by an underscore and exactly 32 base64url characters (A-Z, a-z, 0-9, hyphen, underscore)."
}
```

The aggregate is `"Failed to save some configuration values: "` followed by
`` `${field}: ${error.message ?? 'REDACTED'}` `` for each failed field, joined with `; `. Validator
messages are generic and never echo the rejected raw value.

Key contract notes:

- The backend iterates over the full list of writable fields, checks `if (value === undefined) continue`
  for each, and writes only supplied fields. Omitted fields are never read or touched.
- Validation failures are aggregated. Each failed field appends
  `` `${name}: ${error.message ?? 'REDACTED'}` `` to the error list; validator messages are generic
  domain messages that never echo the raw value, so no credential secret is exposed. On any validation
  failure the handler logs with `ABLogger` and returns `{ success: false, error: <aggregated> }`.
- **Configuration-lock contention is a transport-layer failure, not part of this result union.**
  `commitBackendConfigPatch_()` rethrows `CONFIG_LOCK_CONTENTION` as an `ApiRateLimitError`, so the
  response is the standard `apiHandler` error envelope with `code: 'RATE_LIMITED'` and
  `retriable: true` rather than `{ success: false }`. `CONFIG_BLOB_TOO_LARGE` stays in the aggregate
  `{ success: false, error }` path.
- The frontend form mapper (`mapBackendSettingsFormValuesToBackendConfigWriteInput`) only includes
  `apiKey` when the form value is non-empty, preventing accidental clearing of the stored key.
- A raw backend call with an explicit empty-string `apiKey` **clears** the stored key: the empty
  string is staged through `preparePropertyValue('apiKey', '')` (the validator's single accepted
  clearing value) and committed by the locked write as the serialised value `''`, so `hasApiKey`
  becomes `false`. This capability is **backend-only**: the frontend write schema rejects empty
  strings, so UI users cannot clear a stored key (see discrepancy #4).
- This endpoint is wrapped by the standard `apiHandler` transport envelope
  (see [transport-envelope.md](transport-envelope.md)).
- **Auth fields are not written here.** `setBackendConfig_()` rejects `authMode`,
  `authGroupEmail`, `authUsers`, and `authRevision` as `INVALID_REQUEST` for every caller
  before any ordinary field is staged; auth-group-email writes therefore no longer flow through
  this endpoint. Auth state is validated and committed exclusively by the dedicated
  `setAuthenticationSettings` path — see the mechanism block below and
  [Contract: AuthUsers](auth-users.md).
- **Auth-save validation and commit mechanism (remediation batch):** the dedicated
  `setAuthenticationSettings` path does **not** route through the per-field `CONFIG_SCHEMA`
  setters. `AuthSettingsDomain.validatedSaveCandidate()` validates the complete candidate with the
  strict `validateAuthStateStrict_` resolver — the same single validation authority the security read
  uses — then `AuthSettingsDomain.commitSettingsSave()` commits the whole blob in ONE
  `writeConfigurationLocked` mutation (the raw, locked write path). The auth fields are therefore
  never rewritten field-by-field. In `googleGroups` mode the strict resolver requires a non-blank,
  valid `authGroupEmail`, so a save that would clear it is rejected as a candidate-validation failure
  with the resolver's message ("Google Groups auth mode requires a non-blank group email."), not the
  `CONFIG_SCHEMA` once-set message.
- **`CONFIG_SCHEMA` `authGroupEmail` once-set guard (unreached from transport):** the `validate` seam
  still rejects clearing a stored non-blank `authGroupEmail` ("Auth Group Email cannot be cleared once
  set."), but no transport reaches it: `setBackendConfig` rejects the field outright, and
  `setAuthenticationSettings` validates/writes through the strict resolver + locked raw write above.
  It is reached only by a direct internal `setAuthGroupEmail()` / `setProperty()` call. Recovery for a
  lockout remains hand-editing Script Properties (SPEC Admin lockout recovery).
- **Form-schema reconciliation (implemented, Section 8):** the frontend
  `BackendSettingsFormSchema` no longer declares `authGroupEmail`/`authMode`, and the
  form-level compulsory-once-set guard was removed from
  `BackendSettingsPanel.handleFinish`. Auth state is owned by the dedicated
  Authentication tab via the auth endpoints (see [Contract: AuthUsers](auth-users.md)).

---

## Sub-entities

None. BackendConfig is a standalone contract with no embedded sub-entities.

---

## Validation

**Frontend Zod:**

- `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`:
  - `BackendConfigSchema` — validates the `getBackendConfig` response (12 non-auth fields + optional `loadError`). Uses `.strict()`. `authGroupEmail`/`authMode` are **not** part of the schema (frontend lockstep landed, Section 7).
  - `BackendConfigWriteInputSchema` — validates the `setBackendConfig` request (10 ordinary writable fields, all optional; `authGroupEmail`/`authMode` are **not** accepted and are rejected by the backend). Uses `.strict()` — the strict lockstep matches the backend's `INVALID_REQUEST` rejection of every auth field (Section 7).
  - `BackendConfigWriteResultSchema` — validates the `setBackendConfig` response. Discriminated union of `{ success: true }` and `{ success: false, error: string }`. Both branches use `.strict()`. Configuration-lock contention is **not** represented here; it is the transport-level `RATE_LIMITED` error envelope (see the write key notes).
  - `NonEmptyStringSchema` — module-private `z.string().min(1)`. The read/write schemas apply it to `jsonDbMasterIndexKey` and `jsonDbLogLevel`, so a blank value is rejected at the transport boundary as well as by the backend (`Validate.validateNonEmptyString` / `validateLogLevel_`). This is the non-empty contract surfaced by the remediation batch (see discrepancy #12).
- `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`:
  - `BackendSettingsFormSchema` — form-level validation with `superRefine` for API key token check. Uses `.strict()`. The form schema no longer declares `authGroupEmail`/`authMode` (Section 8); the auth surface moves to the dedicated Authentication tab.
- `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts`:
  - `isBackendApiKeyToken(value)` — validates the write API key token: an alphanumeric prefix, an underscore, then exactly 32 base64url characters (`A-Z`, `a-z`, `0-9`, `-`, `_`). Mirrors the backend `API_KEY_PATTERN`.
  - `isMaskedBackendApiKeyValue(value)` — validates masked API key value matches the backend masking contract (`''` \| `'****'` \| `'****'` + 4 characters).
  - `isDriveFolderId(value)` — validates Drive folder ID shape (min 10 chars, alphanumeric + underscores + hyphens).

**Backend transport validation:**

- `src/backend/z_Api/apiConfig.js`:
  - `getBackendConfig_()` — builds the response from exactly the 12 non-auth typed getters; `authGroupEmail` and `authMode` are never read into the payload (auth state is owned by the dedicated auth endpoints).
  - `setBackendConfig_(config)` — validates `params` is a plain object (throws `ApiValidationError` for non-object/array). **Rejects any auth field** (`authMode`, `authGroupEmail`, `authUsers`, `authRevision`) present on the payload as a single `ApiValidationError` (`INVALID_REQUEST`) for every caller, including admins, before any ordinary field is staged. Defers per-field validation of ordinary fields to `ConfigurationManager.preparePropertyValue()` → `CONFIG_SCHEMA` rules, then commits the whole patch through one `writeConfigurationLocked` call.
- `src/backend/ConfigurationManager/01_configKeysAndSchema.js` — `CONFIG_SCHEMA` defines per-key validation (ordinary fields only; auth fields are validated in the dedicated auth-endpoint path, see [Contract: AuthUsers](auth-users.md)):
  - Integer fields: `Validate.validateIntegerInRange()` with domain-appropriate bounds.
  - `apiKey`: `validateApiKey()` — pattern check.
  - `backendUrl`: `Validate.validateUrl()` — URL string validation.
  - `revokeAuthTriggerSet` / `jsonDbBackupOnInitialise`: `Validate.validateBoolean()` + normalise via `toBooleanString`.
  - `jsonDbLogLevel`: `validateLogLevel()` — enum check + normalise.
  - `jsonDbRootFolderId`: calls `instance.isValidGoogleDriveFolderId()` which checks format via regex and existence via `DriveApp.getFolderById()`.
  - `authGroupEmail`: blank-tolerant email validation (blank → allowed; non-blank → validated as email) using the `(value, instance)` signature (precedent: the `JSON_DB_ROOT_FOLDER_ID` validator). The `CONFIG_SCHEMA` once-set guard is present but unreached from any transport (see the auth-save mechanism note above): `setAuthenticationSettings` validates the candidate with `validateAuthStateStrict_` and commits through `writeConfigurationLocked`, never through `preparePropertyValue`.
  - `authMode`: enum validation accepting only `googleGroups` and `scriptProperties` (`'none'` was removed and is rejected as an unrecognised mode); `getAuthMode()` resolves an absent `authMode` paired with a non-blank `authGroupEmail` to `googleGroups` (legacy leniency) and resolves to `null` otherwise (see discrepancy #9).

**Key domain validation rules:**

- Integer fields are clamped at the backend getter level (`getIntConfig()` returns the fallback default if the stored value is out of range). Write path rejects out-of-range values via CONFIG_SCHEMA validation.
- `jsonDbRootFolderId` write validation requires the folder to actually exist in Drive (checked via `DriveApp.getFolderById()`). This is a heavyweight side-effect validation that is not mirrored in the frontend form schema (frontend validates only the identifier pattern).
- API key validation on the write path validates against the `API_KEY_PATTERN` regex (`^[A-Za-z0-9]+_[A-Za-z0-9_-]{32}$`: an alphanumeric prefix, an underscore, then exactly 32 base64url characters). An explicit empty string is the single accepted clearing value; whitespace-only, `null`, numeric, and malformed non-empty values are rejected. The frontend `isBackendApiKeyToken` mirrors the token pattern.
- `backendUrl` is stored as a plain string; no validation on read is performed beyond returning whatever is in storage.
- `authGroupEmail`: blank is allowed only when nothing is stored. The `CONFIG_SCHEMA` once-set guard rejects clearing a stored non-blank value, but that guard is unreached from any transport (see the auth-save mechanism note above). The blank-aware getter returns `''` when unset.

### Known discrepancies

1. **`revokeAuthTriggerSet` is writable in backend but excluded from frontend write schema.**
   The `setBackendConfig_()` handler accepts and writes `revokeAuthTriggerSet`, but
   `BackendConfigWriteInputSchema` (and the form mapper) intentionally exclude it. The frontend
   treats this field as read-only, surfacing it in the settings UI but never sending it back.
   **Classification: Aligned** — deliberate design choice. The backend can still write it if
   called via a different path (e.g. raw API call, tests).

2. **`backendUrl` write schema stricter than read schema.**
   Read response: `BackendUrlSchema` (`z.union([z.url(), z.literal('')])`) allows empty string.
   Write request: `z.url().optional()` requires a valid URL and does not allow empty string.
   The backend `ConfigurationManager` can return an empty `backendUrl` (e.g. before first save),
   but the frontend will not send a blank URL in a write request.
   **Classification: Aligned** — the form field is required and URL-validated; a blank URL
   can only be read, not written.

3. **`loadError` field exists in frontend Zod but not in backend response.**
   `BackendConfigSchema` includes `loadError: z.string().optional()` which is populated
   client-side (by the service layer) when the API request itself fails. The backend never
   sends this field.
   **Classification: Aligned** — frontend-only field for error surfaced handling.

4. **Form mapping transforms apiKey: read echoes '' and write omits when blank.**
   `mapBackendConfigToBackendSettingsFormValues()` always sets `apiKey` to `''` to avoid
   echoing the masked transport value into a password input. `mapBackendSettingsFormValuesToBackendConfigWriteInput()`
   only includes `apiKey` in the write payload when the form value is non-empty (preserving
   the stored key across a save that doesn't touch the API key field).
   **Frontend clearing limitation:** because the form mapper omits `apiKey` when blank and
   `BackendApiKeyWriteSchema` rejects an empty string (the API-key token pattern requires at
   least one alphanumeric segment), the frontend UI **cannot** clear a stored key. Clearing
   is honoured only by a raw backend call that sends an explicit empty-string `apiKey`; UI
   users cannot invoke it.
   **Classification: Aligned** — deliberate transformation layer between transport schema
   and form state.

5. **`jsonDbRootFolderId` backend validation differs from frontend validation.**
   Backend write validation (`CONFIG_SCHEMA`) checks format via regex **and** calls
   `DriveApp.getFolderById()` to verify the folder actually exists. Frontend form validation
   (`isDriveFolderId`) only checks the identifier format (alphanumeric, underscores, hyphens,
   min 10 chars). The frontend cannot replicate the Drive existence check without a server round-trip.
   **Classification: Aligned** — the backend is the authoritative validator; the frontend
   catches only format errors before submission.

6. **`BackendConfigSchema` uses `.strict()` — backend may add unknown fields in future.**
   The read schema is `.strict()`, meaning any unexpected backend field will cause a Zod
   validation error on the frontend. The backend `getBackendConfig` response now contains
   exactly the 12 non-auth fields documented in the read table (Section 6 landed); `authMode`
   and `authGroupEmail` are no longer emitted. If a new config field is added to the backend
   response without updating the frontend schema, the entire `getBackendConfig` response will be
   rejected.
   **Classification: Aligned** — deliberate tight coupling by design. To add a new config field,
   both backend and frontend schemas must be updated in lockstep. The earlier auth-field
   deploy-order tolerance (discrepancies #7/#8) no longer applies because those fields left the
   transport.

7. **Resolved — `authGroupEmail` no longer appears in the BackendConfig read transport (Section 6 landed).**
   `getBackendConfig_()` no longer reads `getAuthGroupEmail()` into the payload, so the
   backend emits exactly the 12 non-auth fields. The frontend `BackendConfigSchema` dropped
   the field in lockstep (Section 7), and the settings form/panel no longer expose it
   (Section 8). The earlier backend-ahead-of-frontend `.strict()` rejection risk is therefore
   moot for this field.
   **Classification: Aligned (historical)** — the deploy-order tolerance is no longer needed now
   that neither side carries the field.

8. **Resolved — `authMode` no longer appears in the BackendConfig read transport (Section 6 landed).**
   `getBackendConfig_()` no longer reads `getAuthMode()` into the payload; auth mode is read only
   through the dedicated auth endpoints. The frontend `BackendConfigSchema` dropped the field in
   lockstep (Section 7), and the settings form/panel no longer expose it (Section 8). The earlier
   backend-ahead-of-frontend `.strict()` rejection risk is moot for this field.
   **Classification: Aligned (historical)** — the deploy-order tolerance is no longer needed now
   that neither side carries the field.

9. **Persistence-table `authMode` row documents the storage contract only; the removed `'none'` mode is gone (Section 1 schema change).**
   Row 14 documents `googleGroups \| scriptProperties` (the `'none'` bypass removed) and is
   consistent with `01_configKeysAndSchema.js` which accepts only `googleGroups`/`scriptProperties`.
   `getAuthMode()` resolves an absent `authMode` paired with a non-blank `authGroupEmail` to
   `googleGroups` (legacy leniency) and resolves to `null` otherwise. The read transport no longer
   emits `authMode` at all (Section 6 landed), so the historical frontend `z.enum(['googleGroups', 'none'])`
   rejection risk is moot; the frontend schema correction to `['googleGroups', 'scriptProperties']`
   and the dropping of the field shipped in Section 7, with the form/panel removal in Section 8.
   **Classification: Aligned (storage-only)** — the persistence row is correct; the field's absence
   from the BackendConfig transport and the frontend lockstep are both implemented.

   > Surfaced during the Section 2 data-shapes gate; transport removal confirmed landed in Section 6.
   > Origin: Section 1 (config schema and storage foundations).

10. **Locked-write contention is typed and retriable; blob-cap failure remains aggregate (configuration/API remediation batch).**
    `writeConfigurationLocked` throws errors carrying `code` (`CONFIG_LOCK_CONTENTION` /
    `CONFIG_BLOB_TOO_LARGE`) and a `retriable` boolean.
    `commitBackendConfigPatch_()` now catches `CONFIG_LOCK_CONTENTION` and rethrows it as an
    `ApiRateLimitError`, so the dispatcher emits the standard error envelope with
    `code: 'RATE_LIMITED'` and `retriable: true` — a client can distinguish a retriable contention
    from a permanent validation rejection. `CONFIG_BLOB_TOO_LARGE` is not special-cased and still
    surfaces through the aggregate `{ success: false, error }` string, which carries no
    `code`/`retriable`; it is non-retriable by nature (the payload must shrink) and the write is
    rejected with storage unchanged.
    **Classification: Aligned** — SPEC decision 12 requires contention to yield a retriable
    envelope, which the remediation batch implements. Flattening the non-retriable cap into the
    aggregate is acceptable because the aggregate already communicates a permanent failure.

    > Previously classified Misaligned; transport-boundary contention mapping implemented in the
    > configuration/API remediation batch (2026-09-10).

11. **Aggregate-error redaction reconciled to the implementation (Section 6 landed; remediation batch names updated).**
    The write transport appends `` `${name}: ${error?.message ?? 'REDACTED'}` `` for each field that
    fails `preparePropertyValue` in `stageBackendConfigPatch_()` (`apiConfig.js`), and the
    non-contention locked-write failure path in `commitBackendConfigPatch_()` wraps the patch keys in
    the same aggregate string. Validator messages are generic domain messages (e.g. "API Key must be an
    alphanumeric prefix followed by an underscore and exactly 32 base64url characters (A-Z, a-z, 0-9,
    hyphen, underscore).") and never echo the raw input value, so no API key secret or other credential
    reaches the client — the only value-shaped risk (`apiKey` echoing its input) does not occur because
    the API-key validator returns a format message, not the supplied token. `setBackendConfig_`'s
    auth-field rejection is a thrown `ApiValidationError` (a transport-shape violation) and does not
    produce an aggregate.
    **Classification: Aligned** — the ordinary-field aggregate redaction behaviour is unchanged by the
    Section 6 migration (single locked write, fresh merge, 8KB cap all preserved) and now matches the doc.

    > Surfaced during the Section 2 data-shapes gate; reconciled prose to match implementation in Section 6,
    > helper names refreshed in the configuration/API remediation batch.
    > Origin: pre-existing, not introduced by this cycle.

12. **Resolved — `NonEmptyStringSchema` enforces the non-empty invariant its name declares (configuration/API remediation batch).**
    `backendConfiguration.zod.ts` defines `NonEmptyStringSchema` as `z.string().min(1)` and applies it
    to `jsonDbMasterIndexKey` and `jsonDbLogLevel` in both `BackendConfigSchema` and
    `BackendConfigWriteInputSchema`. Before the remediation batch the helper was `z.string()` despite
    its name, so a blank `jsonDbMasterIndexKey`/`jsonDbLogLevel` could pass frontend validation where
    the backend `CONFIG_SCHEMA` rejects it (`Validate.validateNonEmptyString` / `validateLogLevel_`).
    The frontend now matches the backend invariant and dedicated non-empty tests cover both schemas.
    **Classification: Aligned** — the frontend and backend non-empty invariants agree.

    > Surfaced and fixed in the configuration/API remediation batch (2026-09-10).

---

## File Index

```
Persistence:                 src/backend/ConfigurationManager/
  ├── 01_configKeysAndSchema.js     — CONFIG_KEYS, CONFIG_SCHEMA, MAX_CONFIG_BLOB_BYTES
  ├── 02_defaults.js               — DEFAULTS
  ├── 03_validators.js             — Shared validators (API_KEY_PATTERN, etc.)
  ├── 96_ConfigurationManagerStorage.js — raw blob read/parse (safeParseConfigObject_)
  ├── 97_ConfigurationManagerDefaults.js — ensureDefaultConfiguration() seeding
  ├── 97_ConfigurationManagerLockedWrite.js — writeConfigurationLocked(), isFreshInstall()
  └── 98_ConfigurationManagerClass.js  — ConfigurationManager singleton facade

API handlers:                src/backend/z_Api/
  ├── apiConfig.js                 — getBackendConfig_(), setBackendConfig_()
  └── z_apiHandler.js              — apiHandler(), ALLOWLISTED_METHOD_HANDLERS registration

Transport envelope:          src/backend/z_Api/z_apiHandler.js
  └── apiHandler(), ApiDispatcher, ALLOWLISTED_METHOD_HANDLERS

Frontend:
  ├── src/frontend/src/services/backendConfiguration/
  │   ├── backendConfiguration.zod.ts
  │   │     → BackendConfigSchema, BackendConfigWriteInputSchema,
  │   │       BackendConfigWriteResultSchema, NonEmptyStringSchema (module-private)
  │   ├── backendConfigurationService.ts
  │   │     → getBackendConfig(), setBackendConfig()
  │   └── backendConfigurationValidation.ts
  │         → isBackendApiKeyToken(), isMaskedBackendApiKeyValue(), isDriveFolderId()
  └── src/frontend/src/features/settings/backend/
      ├── backendSettingsForm.zod.ts
      │     → BackendSettingsFormSchema
      ├── backendSettingsFieldDescriptors.tsx
      │     → backendSettingsFieldDescriptors, backendSettingsFieldNames,
      │       backendSettingsSectionOrder, createBackendSettingsFieldValidator
      └── backendSettingsFormMapper.ts
            → mapBackendConfigToBackendSettingsFormValues(),
              mapBackendSettingsFormValuesToBackendConfigWriteInput()
```
