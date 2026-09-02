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

---

## Persistence

BackendConfig has no model class with `toJSON()`. Configuration is managed by the
`ConfigurationManager` singleton, which reads/writes a single JSON blob from
`PropertiesService.getScriptProperties()` under the key `__CONFIG_STORE_KEY__`.

All stored values are serialised as strings via `String(normalizedValue)` before being
written into the JSON blob. When read back, typed getter methods (e.g.
`getBackendAssessorBatchSize()`) convert from strings to the expected types. The transport
layer calls these typed getters and returns properly-typed values.

The `ensureDefaultConfiguration()` method seeds defaultable fields on first boot if no
prior configuration exists. Notable fields that are **not** seeded during initialisation:
`apiKey`, `backendUrl`, `jsonDbRootFolderId`, and `authGroupEmail` are excluded from `ensureDefaultConfiguration()` seeding. Adding
`AUTH_GROUP_EMAIL: ''` to `02_defaults.js` does **not** seed it — seeding runs via eight
explicit setters only, and the `DEFAULTS` entry supplies the getter fallback only, not a
seeded property.

| #   | Field                      | Stored type                        | Persistence                                                       | Transport                                                   | Frontend Zod                                                           | Notes                                                                                                                       |
| --- | -------------------------- | ---------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | `backendAssessorBatchSize` | `string` (number stored as string) | Always included                                                   | `number` — parsed via `getIntConfig()`                      | `z.number().int()`                                                     | Default 120. Clamped to [1, 500].                                                                                           |
| 2   | `apiKey`                   | `string`                           | Always included                                                   | `string` — masked via `maskApiKey_()`                       | `MaskedApiKeySchema` — `z.string().refine(isMaskedBackendApiKeyValue)` | Never raw stored value in transport. Empty string when no key stored. See [$transport-masking](#transport) for mask shapes. |
| 3   | `hasApiKey`                | `boolean\|string`                  | Not stored directly; derived at transport time from `!!rawApiKey` | `boolean` — `!!rawApiKey`                                   | `z.boolean()`                                                          | Computed at transport boundary, not persisted.                                                                              |
| 4   | `backendUrl`               | `string`                           | Always included                                                   | `string` — may be empty                                     | `BackendUrlSchema` — `z.union([z.url(), z.literal('')])`               | Empty string when unset. Read transport allows blank; write requires valid URL.                                             |
| 5   | `revokeAuthTriggerSet`     | `string` (`'true'` / `'false'`)    | Always included                                                   | `boolean` — via `ConfigurationManager.toBoolean()`          | `z.boolean()`                                                          | Treated as read-only by frontend (not in write input schema).                                                               |
| 6   | `daysUntilAuthRevoke`      | `string` (number stored as string) | Always included                                                   | `number` — parsed via `getIntConfig()`                      | `z.number().int()`                                                     | Default 60. Clamped to [1, 365].                                                                                            |
| 7   | `slidesFetchBatchSize`     | `string` (number stored as string) | Always included                                                   | `number` — parsed via `getIntConfig()`                      | `z.number().int()`                                                     | Default 30. Clamped to [1, 100].                                                                                            |
| 8   | `jsonDbMasterIndexKey`     | `string`                           | Always included                                                   | `string` — returns default if stored value is empty         | `z.string()` (non-empty enforced)                                      | Default `'ASSESSMENT_BOT_DB_MASTER_INDEX'`.                                                                                 |
| 9   | `jsonDbLockTimeoutMs`      | `string` (number stored as string) | Always included                                                   | `number` — parsed via `getIntConfig()`                      | `z.number().int()`                                                     | Default 30000. Clamped to [1000, 600000].                                                                                   |
| 10  | `jsonDbLogLevel`           | `string`                           | Always included                                                   | `string` — trimmed and uppercased by getter                 | `z.string()`                                                           | Default `'INFO'`. Valid levels: `DEBUG`, `INFO`, `WARN`, `ERROR`.                                                           |
| 11  | `jsonDbBackupOnInitialise` | `string` (`'true'` / `'false'`)    | Always included                                                   | `boolean` — via `ConfigurationManager.toBoolean()`          | `z.boolean()`                                                          | Default `false`.                                                                                                            |
| 12  | `jsonDbRootFolderId`       | `string`                           | Always included                                                   | `string` — coerced to `''` when blank/null                  | `z.string()`                                                           | May be empty string when unset. Transport normalises `null` → `''`.                                                         |
| 13  | `authGroupEmail`           | `string`                           | Always included                                                   | `string` — always emitted via `getAuthGroupEmail() \|\| ''` | `z.union([z.literal(''), z.email()]).optional()`                       | Blank when unset (fail-open bootstrap). Compulsory once set — clearing a stored value is rejected.                          |
| 14  | `authMode`                 | `string`                           | Always included                                                   | `string` — `googleGroups` \| `none` via `getAuthMode()`     | `z.enum(['googleGroups', 'none']).optional()`                          | Default `googleGroups`. `none` disables the group-membership gate (development/testing only).                               |

Key notes:

- All values are stored as strings in the JSON blob. Typed getters convert on read.
- `hasApiKey` is not a stored field; it is derived at transport time from `!!rawApiKey`.
- `apiKey`, `backendUrl`, `jsonDbRootFolderId`, and `authGroupEmail` are excluded from `ensureDefaultConfiguration()` seeding. Adding
  `AUTH_GROUP_EMAIL: ''` to `02_defaults.js` does **not** seed it — seeding runs via eight
  explicit setters only, and the `DEFAULTS` entry supplies the getter fallback only, not a
  seeded property.
- `jsonDbRootFolderId` normalisation: `configManager.getJsonDbRootFolderId() || ''` ensures the transport always returns a string.
- `authGroupEmail` normalisation: `configManager.getAuthGroupEmail() || ''`
  ensures the transport always returns a string when the value is unset or blank (fail-open bootstrap).

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

| Field                      | Type                      | Required | Notes                                        |
| -------------------------- | ------------------------- | -------- | -------------------------------------------- |
| `backendAssessorBatchSize` | `number`                  | yes      | Integer. Default 120.                        |
| `apiKey`                   | `string`                  | yes      | Masked value. See masking contract below.    |
| `hasApiKey`                | `boolean`                 | yes      | `true` when a raw API key exists in storage. |
| `backendUrl`               | `string` (URL \| empty)   | yes      | May be empty string when unset.              |
| `revokeAuthTriggerSet`     | `boolean`                 | yes      |                                              |
| `daysUntilAuthRevoke`      | `number`                  | yes      | Integer. Default 60.                         |
| `slidesFetchBatchSize`     | `number`                  | yes      | Integer. Default 30.                         |
| `jsonDbMasterIndexKey`     | `string`                  | yes      |                                              |
| `jsonDbLockTimeoutMs`      | `number`                  | yes      | Integer. Default 30000.                      |
| `jsonDbLogLevel`           | `string`                  | yes      | One of `DEBUG`, `INFO`, `WARN`, `ERROR`.     |
| `jsonDbBackupOnInitialise` | `boolean`                 | yes      |                                              |
| `jsonDbRootFolderId`       | `string`                  | yes      | May be empty string when unset.              |
| `authGroupEmail`           | `string` (email \| empty) | yes      | Always emitted; `''` when unset.             |
| `authMode`                 | `string`                  | yes      | Always emitted; `googleGroups` when unset.   |

Key contract notes:

- The handler calls `configManager.ensureDefaultConfiguration()` first, which seeds
  defaultable fields on first boot. After seeding, it builds the response from typed getters.
- **API key masking contract** (`maskApiKey_()`):
  - No key stored → `''` (empty string)
  - Key length ≤ 4 chars → `'****'`
  - Key length > 4 chars → `'****'` + last 4 characters (e.g. `'****7890'`)
- `jsonDbRootFolderId` normalisation: `configManager.getJsonDbRootFolderId() || ''` produces
  empty string when the stored value is `null` (the default) or blank.
- `authGroupEmail` normalisation: `configManager.getAuthGroupEmail() || ''` produces empty string when the stored value is unset or blank (fail-open bootstrap state).
- **Frontend `.strict()` lockstep:** `BackendConfigSchema` uses
  `.strict()`, so the deploy-order constraint is asymmetric: the backend must not emit
  `authGroupEmail` before the frontend schema accepts it (an unknown key under `.strict()`
  rejects the whole read); the reverse order — frontend schema accepting the field while the
  backend does not yet emit it — is safe because the field is `.optional()` (see
  discrepancy #7).
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

| Field                      | Type                      | Required | Notes                                                                                                                                                                                                                    |
| -------------------------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backendAssessorBatchSize` | `number`                  | no       | Must be integer 1–500.                                                                                                                                                                                                   |
| `apiKey`                   | `string`                  | no       | Validated against API key pattern (alphanumeric segments, hyphens, no leading/trailing/consecutive hyphens). Explicit empty string clears the stored key.                                                                |
| `backendUrl`               | `string` (URL)            | no       | Must be a valid URL.                                                                                                                                                                                                     |
| `daysUntilAuthRevoke`      | `number`                  | no       | Must be integer 1–365.                                                                                                                                                                                                   |
| `slidesFetchBatchSize`     | `number`                  | no       | Must be integer 1–100.                                                                                                                                                                                                   |
| `jsonDbMasterIndexKey`     | `string`                  | no       | Non-empty string.                                                                                                                                                                                                        |
| `jsonDbLockTimeoutMs`      | `number`                  | no       | Must be integer 1000–600000.                                                                                                                                                                                             |
| `jsonDbLogLevel`           | `string`                  | no       | One of `DEBUG`, `INFO`, `WARN`, `ERROR`.                                                                                                                                                                                 |
| `jsonDbBackupOnInitialise` | `boolean`                 | no       |                                                                                                                                                                                                                          |
| `jsonDbRootFolderId`       | `string`                  | no       | Must be a valid Google Drive folder ID (alphanumeric, underscores, hyphens; minimum 10 chars) _as validated by the backend's `isValidGoogleDriveFolderId` which also verifies existence via `DriveApp.getFolderById()`_. |
| `authGroupEmail`           | `string` (email \| empty) | no       | Blank-tolerant email (`z.union([z.literal(''), z.email()])`). Compulsory once set: a blank value is rejected when a non-blank value is already stored.                                                                   |
| `authMode`                 | `string`                  | no       | One of `googleGroups` \| `none`. Default `googleGroups`.                                                                                                                                                                 |

**Request validation notes:**

- `params` must be a plain object; `ApiValidationError` is thrown otherwise.
- Each supplied field whose `value !== undefined` is written via the corresponding
  `ConfigurationManager` setter.
- The frontend `BackendConfigWriteInputSchema` uses `.strict()` — fields outside the schema
  are silently stripped before the request reaches the backend.
- The writable field set in the backend is the **superset** of all 13 writable fields
  (12 documented in the table above + `revokeAuthTriggerSet`; the frontend schema
  intentionally excludes `revokeAuthTriggerSet`).

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
  "error": "Failed to save some configuration values: backendUrl: REDACTED; apiKey: REDACTED"
}
```

Key contract notes:

- The backend iterates over the full list of writable fields, checks `if (value === undefined) continue`
  for each, and writes only supplied fields. Omitted fields are never read or touched.
- Errors are aggregated. Each failed field appends `"${name}: REDACTED"` to the error list (secrets
  are never exposed in error messages). On any failure, the handler logs with `ABLogger` and returns
  `{ success: false, error: <aggregated> }`.
- The frontend form mapper (`mapBackendSettingsFormValuesToBackendConfigWriteInput`) only includes
  `apiKey` when the form value is non-empty, preventing accidental clearing of the stored key.
- A raw backend call with an explicit empty-string `apiKey` **clears** the stored key (the backend
  `setProperty` serialises `''` → `"''"` and writes it). This capability is **backend-only**: the
  frontend write schema rejects empty strings, so UI users cannot clear a stored key (see
  discrepancy #4).
- This endpoint is wrapped by the standard `apiHandler` transport envelope
  (see [transport-envelope.md](transport-envelope.md)).
- `authGroupEmail` write: `setBackendConfig_()` adds an
  `updates` array entry calling `configManager.setAuthGroupEmail(value)`.
- **Backend-enforced compulsory-once-set:**
  `setAuthGroupEmail('')` is rejected by the `CONFIG_SCHEMA` validator when a non-blank value
  is already stored — the stored value is preserved. The rejection surfaces on the write path
  only as the redacted aggregate entry (`authGroupEmail: REDACTED`); the message carries no
  "clearing is not allowed" semantics. The user-facing explanation comes from the frontend
  compulsory-once-set guard in `BackendSettingsPanel.handleFinish` (ACTION_PLAN §11) — the
  backend layer is defence-in-depth, not the UX path. Changing to a different non-blank email
  remains allowed. Recovery stays via hand-editing Script Properties (SPEC Admin lockout
  recovery).
- **Form-schema reconciliation:** the frontend
  `BackendSettingsFormSchema` mirrors the transport contract with
  `z.union([z.literal(''), z.email()])` (blank-tolerant) plus a form-level compulsory-once-set
  guard in `BackendSettingsPanel.handleFinish`.

---

## Sub-entities

None. BackendConfig is a standalone contract with no embedded sub-entities.

---

## Validation

**Frontend Zod:**

- `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`:
  - `BackendConfigSchema` — validates the `getBackendConfig` response (14 fields + optional `loadError`; `authGroupEmail` and `authMode` are optional). Uses `.strict()`.
  - `BackendConfigWriteInputSchema` — validates the `setBackendConfig` request (12 writable fields, all optional, including `authGroupEmail` and `authMode`). Uses `.strict()`.
  - `BackendConfigWriteResultSchema` — validates the `setBackendConfig` response. Discriminated union of `{ success: true }` and `{ success: false, error: string }`. Both branches use `.strict()`.
- `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`:
  - `BackendSettingsFormSchema` — form-level validation with `superRefine` for API key token check. Uses `.strict()`.
  - `authGroupEmail` form field: `z.union([z.literal(''), z.email()])`
    — blank-tolerant, following the transport idiom; form-level compulsory-once-set is enforced
    in `BackendSettingsPanel.handleFinish` (submitting blank while a non-blank baseline is loaded
    sets a field error and skips the save).
- `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts`:
  - `isBackendApiKeyToken(value)` — validates API key token shape (alphanumeric + hyphens, no leading/trailing/consecutive hyphens).
  - `isMaskedBackendApiKeyValue(value)` — validates masked API key value matches the backend masking contract (`''` \| `'****'` \| `'****'` + 4 characters).
  - `isDriveFolderId(value)` — validates Drive folder ID shape (min 10 chars, alphanumeric + underscores + hyphens).

**Backend transport validation:**

- `src/backend/z_Api/apiConfig.js`:
  - `setBackendConfig_(config)` — validates `params` is a plain object (throws `ApiValidationError` for non-object/array). Defers per-field validation to `ConfigurationManager.setProperty()` → `CONFIG_SCHEMA` rules.
- `src/backend/ConfigurationManager/01_configKeysAndSchema.js` — `CONFIG_SCHEMA` defines per-key validation:
  - Integer fields: `Validate.validateIntegerInRange()` with domain-appropriate bounds.
  - `apiKey`: `validateApiKey()` — pattern check.
  - `backendUrl`: `Validate.validateUrl()` — URL string validation.
  - `revokeAuthTriggerSet` / `jsonDbBackupOnInitialise`: `Validate.validateBoolean()` + normalise via `toBooleanString`.
  - `jsonDbLogLevel`: `validateLogLevel()` — enum check + normalise.
  - `jsonDbRootFolderId`: calls `instance.isValidGoogleDriveFolderId()` which checks format via regex and existence via `DriveApp.getFolderById()`.
  - `authGroupEmail`: blank-tolerant email validation (blank → allowed; non-blank → validated as email) plus the compulsory-once-set guard in the `CONFIG_SCHEMA` validator, using the `(value, instance)` signature (precedent: the `JSON_DB_ROOT_FOLDER_ID` validator).
  - `authMode`: enum validation accepting only `none` and `googleGroups` (default `googleGroups`); the getter returns `googleGroups` for any value other than the literal `none` (secure-by-default).

**Key domain validation rules:**

- Integer fields are clamped at the backend getter level (`getIntConfig()` returns the fallback default if the stored value is out of range). Write path rejects out-of-range values via CONFIG_SCHEMA validation.
- `jsonDbRootFolderId` write validation requires the folder to actually exist in Drive (checked via `DriveApp.getFolderById()`). This is a heavyweight side-effect validation that is not mirrored in the frontend form schema (frontend validates only the identifier pattern).
- API key validation on the write path validates against the `API_KEY_PATTERN` regex (alphanumeric segments separated by hyphens, no leading/trailing/consecutive hyphens). The frontend `isBackendApiKeyToken` mirrors this pattern.
- `backendUrl` is stored as a plain string; no validation on read is performed beyond returning whatever is in storage.
- `authGroupEmail`: blank is allowed only when nothing is stored; once a non-blank value is stored, clearing it is rejected (compulsory-once-set). The blank-aware getter returns `''` when unset, which triggers the fail-open bootstrap state at the auth gate.

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
   validation error on the frontend. Currently the backend returns exactly the 14 documented
   fields, including `authMode` (now delivered). If a new config field is added to the backend
   response without updating the frontend schema, the entire `getBackendConfig` response will be
   rejected.
   **Classification: Fragile** — tight coupling. The frontend will reject
   unexpected additional fields instead of silently stripping them. To add a new config field,
   both backend and frontend schemas must be updated in lockstep.

7. **Backend always emits `authGroupEmail`; frontend schema marks it `.optional()`.**
   The read transport always emits `authGroupEmail` (`getAuthGroupEmail() || ''`), while
   `BackendConfigSchema` marks the field `z.union([z.literal(''), z.email()]).optional()`.
   Under `.strict()`, backend-ahead-of-frontend deployment would reject the whole read
   (unknown key present), while frontend-ahead-of-backend deployment parses fine (a missing
   key is allowed by `.optional()`).
   **Classification: Aligned** — deliberate deploy-order tolerance so the frontend can ship
   the field before the backend emits it.

8. **Backend always emits `authMode`; frontend schema marks it `.optional()`.**
   The read transport always emits `authMode` (`getAuthMode()` returns `googleGroups` by default),
   while `BackendConfigSchema` marks it `z.enum([...]).optional()`. Same rationale and deploy-order
   tolerance as `authGroupEmail` in discrepancy #7: frontend-ahead-of-backend parses fine (missing
   key allowed by `.optional()`); backend-ahead-of-frontend would reject the read under `.strict()`.
   The form mapper defaults a missing `authMode` to `googleGroups`.
   **Classification: Aligned** — deliberate deploy-order tolerance.

---

## File Index

```
Persistence:                 src/backend/ConfigurationManager/
  ├── 01_configKeysAndSchema.js     — CONFIG_KEYS, CONFIG_SCHEMA
  ├── 02_defaults.js               — DEFAULTS
  ├── 98_ConfigurationManagerClass.js  — ConfigurationManager singleton
  └── 03_validators.js             — Shared validators (API_KEY_PATTERN, etc.)

API handlers:                src/backend/z_Api/
  ├── apiConfig.js                 — getBackendConfig_(), setBackendConfig_()
  └── z_apiHandler.js              — apiHandler(), ALLOWLISTED_METHOD_HANDLERS registration

Transport envelope:          src/backend/z_Api/z_apiHandler.js
  └── apiHandler(), ApiDispatcher, ALLOWLISTED_METHOD_HANDLERS

Frontend:
  ├── src/frontend/src/services/backendConfiguration/
  │   ├── backendConfiguration.zod.ts
  │   │     → BackendConfigSchema, BackendConfigWriteInputSchema, BackendConfigWriteResultSchema
  │   ├── backendConfigurationService.ts
  │   │     → getBackendConfig(), setBackendConfig()
  │   └── backendConfigurationValidation.ts
  │         → isBackendApiKeyToken(), isMaskedBackendApiKeyValue(), isDriveFolderId()
  └── src/frontend/src/features/settings/backend/
      ├── backendSettingsForm.zod.ts
      │     → BackendSettingsFormSchema
      └── backendSettingsFormMapper.ts
            → mapBackendConfigToBackendSettingsFormValues(),
              mapBackendSettingsFormValuesToBackendConfigWriteInput()
```
