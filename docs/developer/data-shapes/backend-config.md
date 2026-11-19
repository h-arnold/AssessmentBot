# Contract: BackendConfig

Singleton configuration store for backend behaviour, exposed to the frontend settings UI
via read and write endpoints.

Backend model: `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js` — singleton (not a Model with `toJSON()`)
Collections: None — persisted as a single JSON blob in script properties via `PropertiesService.getScriptProperties()` under key `__CONFIG_STORE_KEY__`
API handlers: `src/backend/z_Api/apiConfig.js`
Response mapper: None — `getBackendConfig_()` directly shapes data from `ConfigurationManager` methods
Frontend service: `src/frontend/src/services/backendConfiguration/backendConfigurationService.ts`
Frontend Zod: `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`

> Auth state is owned by the dedicated auth endpoints — see
> [Contract: AuthUsers](auth-users.md). This contract covers the non-auth fields.

---

## Persistence

BackendConfig has no model class with `toJSON()`. Configuration is managed by the
`ConfigurationManager` singleton, which reads/writes a single JSON blob from
`PropertiesService.getScriptProperties()` under the key `__CONFIG_STORE_KEY__`.

All stored values are serialised as strings via `String(normalizedValue)` before being
written into the JSON blob. When read back, typed getter methods (e.g.
`getBackendAssessorBatchSize()`) convert from strings to the expected types. The transport
layer calls these typed getters and returns properly-typed values.

All persistent writes serialise through `ConfigurationManager.writeConfigurationLocked(mutator)`.
The facade's
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

| #   | Field                      | Stored type                        | Persistence                                                       | Transport                                                                                                                                                 | Frontend Zod                                                           | Notes                                                                                                                                                                                                                   |
| --- | -------------------------- | ---------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `backendAssessorBatchSize` | `string` (number stored as string) | Always included                                                   | `number` — parsed via `getIntConfig()`                                                                                                                    | `z.number().int()`                                                     | Default 120. Clamped to [1, 500].                                                                                                                                                                                       |
| 2   | `apiKey`                   | `string`                           | Always included                                                   | `string` — masked via `maskApiKey_()`                                                                                                                     | `MaskedApiKeySchema` — `z.string().refine(isMaskedBackendApiKeyValue)` | Never raw stored value in transport. Empty string when no key stored. See [Transport — API key masking](#transport) for mask shapes.                                                                                    |
| 3   | `hasApiKey`                | `boolean\|string`                  | Not stored directly; derived at transport time from `!!rawApiKey` | `boolean` — `!!rawApiKey`                                                                                                                                 | `z.boolean()`                                                          | Computed at transport boundary, not persisted.                                                                                                                                                                          |
| 4   | `backendUrl`               | `string`                           | Always included                                                   | `string` — may be empty                                                                                                                                   | `BackendUrlSchema` — `z.union([z.url(), z.literal('')])`               | Empty string when unset. Read transport allows blank; write requires valid URL.                                                                                                                                         |
| 5   | `revokeAuthTriggerSet`     | `string` (`'true'` / `'false'`)    | Always included                                                   | `boolean` — via `ConfigurationManager.toBoolean()`                                                                                                        | `z.boolean()`                                                          | Treated as read-only by frontend (not in write input schema).                                                                                                                                                           |
| 6   | `daysUntilAuthRevoke`      | `string` (number stored as string) | Always included                                                   | `number` — parsed via `getIntConfig()`                                                                                                                    | `z.number().int()`                                                     | Default 60. Clamped to [1, 365].                                                                                                                                                                                        |
| 7   | `slidesFetchBatchSize`     | `string` (number stored as string) | Always included                                                   | `number` — parsed via `getIntConfig()`                                                                                                                    | `z.number().int()`                                                     | Default 30. Clamped to [1, 100].                                                                                                                                                                                        |
| 8   | `jsonDbMasterIndexKey`     | `string`                           | Always included                                                   | `string` — returns default if stored value is empty                                                                                                       | `NonEmptyStringSchema` (`z.string().min(1)`)                           | Default `'ASSESSMENT_BOT_DB_MASTER_INDEX'`.                                                                                                                                                                             |
| 9   | `jsonDbLockTimeoutMs`      | `string` (number stored as string) | Always included                                                   | `number` — parsed via `getIntConfig()`                                                                                                                    | `z.number().int()`                                                     | Default 30000. Clamped to [30000, 600000].                                                                                                                                                                              |
| 10  | `jsonDbLogLevel`           | `string`                           | Always included                                                   | `string` — trimmed and uppercased by getter                                                                                                               | `NonEmptyStringSchema` (`z.string().min(1)`)                           | Default `'INFO'`. Valid levels: `DEBUG`, `INFO`, `WARN`, `ERROR`.                                                                                                                                                       |
| 11  | `jsonDbBackupOnInitialise` | `string` (`'true'` / `'false'`)    | Always included                                                   | `boolean` — via `ConfigurationManager.toBoolean()`                                                                                                        | `z.boolean()`                                                          | Default `false`.                                                                                                                                                                                                        |
| 12  | `jsonDbRootFolderId`       | `string`                           | Always included                                                   | `string` — coerced to `''` when blank/null                                                                                                                | `z.string()`                                                           | May be empty string when unset. Transport normalises `null` → `''`.                                                                                                                                                     |
| 13  | `authGroupEmail`           | `string`                           | Always included                                                   | Omitted — managed via dedicated auth endpoints (see [Contract: AuthUsers](auth-users.md)); `getAuthGroupEmail()` still exists for the auth gate/bootstrap | Absent from the BackendConfig Zod schemas and the settings form        | Stored in the blob but absent from the BackendConfig transport. Blank when unset. Auth writes are owned by the dedicated auth endpoints (see [Contract: AuthUsers](auth-users.md)).                                     |
| 14  | `authMode`                 | `string`                           | Always included                                                   | Omitted — managed via dedicated auth endpoints (see [Contract: AuthUsers](auth-users.md))                                                                 | Absent from the BackendConfig Zod schemas and the settings form        | `'none'` is an unrecognised mode and is rejected (fail closed). Absent `authMode` with a non-blank `authGroupEmail` reads as `googleGroups` (legacy leniency). Auth fields are not part of the BackendConfig transport. |

Key notes:

- All configuration writes route through `writeConfigurationLocked(mutator)`; the shared script-wide
  lock, raw re-read/merge/single write, and the 8KB cap (`MAX_CONFIG_BLOB_BYTES`, 8192) are enforced
  on every write. Contention yields `CONFIG_LOCK_CONTENTION` (retriable); an over-cap blob yields
  `CONFIG_BLOB_TOO_LARGE` (non-retriable).
- All values are stored as strings in the JSON blob. Typed getters convert on read.
- Integer fields use `Validate.validateIntegerInRange` with safe parsed integers and domain bounds; unsafe numeric inputs are rejected before prefix parsing. Out-of-range stored values fall back to the getter default. Decimal prefix parsing accepts forms such as `'1e21'` as `1`.
- The locked write path is a **persistence-layer** contract. `setBackendConfig_()` stages every
  supplied ordinary field through the manager-owned `preparePropertyValue` seam and commits the whole
  patch through one `writeConfigurationLocked` call — under the lock the raw blob is re-read, merged,
  and written once, so a concurrent writer's changes are preserved (no clobber).
- Locked-write contention is mapped to the typed retriable transport envelope:
  `commitBackendConfigPatch_()` catches `code: 'CONFIG_LOCK_CONTENTION'` and rethrows it as an
  `ApiRateLimitError`, which the dispatcher maps to the retriable `RATE_LIMITED` code. A locked write
  failure that is **not** contention (e.g. `CONFIG_BLOB_TOO_LARGE`) is still folded into the aggregate
  `{ success: false, error }` string, which carries neither the `code` nor the `retriable` flag (see
  [Locked-write failure reporting](#locked-write-failure-reporting)).
- `hasApiKey` is not a stored field; it is derived at transport time from `!!rawApiKey`.
- `apiKey`, `backendUrl`, `jsonDbRootFolderId`, and `authGroupEmail` are excluded from
  `ensureDefaultConfiguration()` seeding. Seeding runs through eight explicit setters; their
  `DEFAULTS` entries supply getter fallbacks, not seeded properties.
- `jsonDbRootFolderId` normalisation: `configManager.getJsonDbRootFolderId() || ''` ensures the transport always returns a string.
- `authGroupEmail` normalisation: `configManager.getAuthGroupEmail() || ''` returns a string when
  the value is unset or blank. This getter is used by the auth gate / access-resolution path, not by
  `getBackendConfig` — the BackendConfig read transport does not emit `authGroupEmail`.

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
| `backendAssessorBatchSize` | `number`                | yes      | Integer.                                     |
| `apiKey`                   | `string`                | yes      | Masked value. See masking contract below.    |
| `hasApiKey`                | `boolean`               | yes      | `true` when a raw API key exists in storage. |
| `backendUrl`               | `string` (URL \| empty) | yes      | May be empty string when unset.              |
| `revokeAuthTriggerSet`     | `boolean`               | yes      |                                              |
| `daysUntilAuthRevoke`      | `number`                | yes      | Integer.                                     |
| `slidesFetchBatchSize`     | `number`                | yes      | Integer.                                     |
| `jsonDbMasterIndexKey`     | `string`                | yes      |                                              |
| `jsonDbLockTimeoutMs`      | `number`                | yes      | Integer.                                     |
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
  read). The read contract is exactly the 12 non-auth fields documented in the table above;
  `authGroupEmail` and `authMode` are not part of the response.
- The handler does **not** call `DateUtils.deepConvertDates()` because no config values
  are `Date` objects.
- The response is plain object shaped inline, not derived from a model's `toJSON()`.
- The frontend schema accepts an optional `loadError?: string` field. The backend does not
  send it and no current producer populates it.

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
  are rejected by Zod before the request reaches the backend.
- The writable ordinary field set in the backend is a superset of the frontend's: it also
  accepts `revokeAuthTriggerSet`, which the frontend schema intentionally excludes. The four
  auth fields are not part of this set — they are rejected outright.

**Response:** `BackendConfigWriteResultSchema` — a union of two strict object branches:

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
  `isRetriable: true` rather than `{ success: false }`. `CONFIG_BLOB_TOO_LARGE` stays in the aggregate
  `{ success: false, error }` path.
- The frontend form mapper (`mapBackendSettingsFormValuesToBackendConfigWriteInput`) only includes
  `apiKey` when the form value is non-empty, preventing accidental clearing of the stored key.
- A raw backend call with an explicit empty-string `apiKey` **clears** the stored key: the empty
  string is staged through `preparePropertyValue('apiKey', '')` (the validator's single accepted
  clearing value) and committed by the locked write as the serialised value `''`, so `hasApiKey`
  becomes `false`. This capability is **backend-only**: the frontend write schema rejects empty
  strings, so UI users cannot clear a stored key (see [API key form mapping](#api-key-form-mapping)).
- This endpoint is wrapped by the standard `apiHandler` transport envelope
  (see [transport-envelope.md](transport-envelope.md)).

---

## Sub-entities

None. BackendConfig is a standalone contract with no embedded sub-entities.

---

## Validation

**Frontend Zod:**

- `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`:
  - `BackendConfigSchema` — validates the `getBackendConfig` response (read fields + optional `loadError`). Uses `.strict()`. `authGroupEmail`/`authMode` are **not** part of the schema.
  - `BackendConfigWriteInputSchema` — validates the `setBackendConfig` request (10 ordinary writable fields, all optional; `authGroupEmail`/`authMode` are **not** accepted and are rejected by the backend). Uses `.strict()` — the strict lockstep matches the backend's `INVALID_REQUEST` rejection of every auth field.
  - `BackendConfigWriteResultSchema` — validates the `setBackendConfig` response. Union of two strict object branches: `{ success: true }` and `{ success: false, error: string }`. Configuration-lock contention is **not** represented here; it is the transport-level `RATE_LIMITED` error envelope (see the write key notes).
  - `NonEmptyStringSchema` — module-private `z.string().min(1)`. The read/write schemas apply it to `jsonDbMasterIndexKey` and `jsonDbLogLevel`, so a blank value is rejected at the transport boundary as well as by the backend (`Validate.validateNonEmptyString` / `validateLogLevel_`). See [Non-empty string schema](#non-empty-string-schema).
- `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`:
  - `BackendSettingsFormSchema` — form-level validation with `superRefine` for API key token check. Uses `.strict()`. The form schema does not declare `authGroupEmail`/`authMode`; authentication is configured on the dedicated Authentication tab.
- `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts`:
  - `isBackendApiKeyToken(value)` — validates the write API key token: an alphanumeric prefix, an underscore, then exactly 32 base64url characters (`A-Z`, `a-z`, `0-9`, `-`, `_`). Mirrors the backend `API_KEY_PATTERN`.
  - `isMaskedBackendApiKeyValue(value)` — validates masked API key value matches the backend masking contract (`''` \| `'****'` \| `'****'` + 4 characters).
  - `isDriveFolderId(value)` — validates Drive folder ID shape (min 10 chars, alphanumeric + underscores + hyphens).

**Backend transport validation:**

- `src/backend/z_Api/apiConfig.js`:
  - `getBackendConfig_()` — builds the response from the non-auth typed getters listed in the read table; `authGroupEmail` and `authMode` are never read into the payload (auth state is owned by the dedicated auth endpoints).
  - `setBackendConfig_(config)` — validates `params` is a plain object (throws `ApiValidationError` for non-object/array). **Rejects any auth field** (`authMode`, `authGroupEmail`, `authUsers`, `authRevision`) present on the payload as a single `ApiValidationError` (`INVALID_REQUEST`) for every caller, including admins, before any ordinary field is staged. Defers per-field validation of ordinary fields to `ConfigurationManager.preparePropertyValue()` → `CONFIG_SCHEMA` rules, then commits the whole patch through one `writeConfigurationLocked` call.
- `src/backend/ConfigurationManager/01_configKeysAndSchema.js` — `CONFIG_SCHEMA` defines per-key validation (ordinary fields only; auth fields are validated in the dedicated auth-endpoint path, see [Contract: AuthUsers](auth-users.md)):
  - Integer fields: `Validate.validateIntegerInRange()` with domain-appropriate bounds.
  - `apiKey`: `validateApiKey_()` — pattern check.
  - `backendUrl`: `Validate.validateUrl()` — URL string validation.
  - `revokeAuthTriggerSet` / `jsonDbBackupOnInitialise`: `Validate.validateBoolean()` + normalise via `toBooleanString_`.
  - `jsonDbLogLevel`: `validateLogLevel_()` — enum check + normalise.
  - `jsonDbRootFolderId`: calls `instance.isValidGoogleDriveFolderId()` which checks format via regex and existence via `DriveApp.getFolderById()`.
  - `authGroupEmail`: blank-tolerant email validation (blank → allowed; non-blank → validated as email) using the `(value, instance)` signature (precedent: the `JSON_DB_ROOT_FOLDER_ID` validator). The `CONFIG_SCHEMA` once-set guard is present but unreached from any transport; auth saves use the strict resolver and the locked write (see [Contract: AuthUsers](auth-users.md)).
  - `authMode`: enum validation accepting only `googleGroups` and `scriptProperties` (`'none'` is rejected as an unrecognised mode); `getAuthMode()` resolves an absent `authMode` paired with a non-blank `authGroupEmail` to `googleGroups` (legacy leniency) and resolves to `null` otherwise (see [authMode persistence row](#authmode-persistence-row)).

**Key domain validation rules:**

- Integer fields are clamped at the backend getter level (`getIntConfig()` returns the fallback default if the stored value is out of range). Write path rejects out-of-range values via CONFIG_SCHEMA validation.
- `jsonDbRootFolderId` write validation requires the folder to actually exist in Drive (checked via `DriveApp.getFolderById()`). This is a heavyweight side-effect validation that is not mirrored in the frontend form schema (frontend validates only the identifier pattern).
- API key validation on the write path validates against the `API_KEY_PATTERN` regex (`^[A-Za-z0-9]+_[A-Za-z0-9_-]{32}$`: an alphanumeric prefix, an underscore, then exactly 32 base64url characters). An explicit empty string is the single accepted clearing value; whitespace-only, `null`, numeric, and malformed non-empty values are rejected. The frontend `isBackendApiKeyToken` mirrors the token pattern.
- `backendUrl` is stored as a plain string; no validation on read is performed beyond returning whatever is in storage.
- `authGroupEmail`: blank is allowed only when nothing is stored. The `CONFIG_SCHEMA` once-set guard rejects clearing a stored non-blank value, but that guard is unreached from any transport (see [Contract: AuthUsers](auth-users.md)). The blank-aware getter returns `''` when unset.

### Known discrepancies

#### `revokeAuthTriggerSet` write availability

`setBackendConfig_()` accepts and writes it, and both the read payload and `BackendConfigSchema`
carry it, while `BackendConfigWriteInputSchema` and the form mapper intentionally exclude it. The
field is neither displayed nor editable in the settings UI: `backendSettingsFieldNames` lists only
the ten editable fields and no `.tsx` file references it, so the frontend never sends it back.

#### `backendUrl` read/write strictness

The read response's `BackendUrlSchema` (`z.union([z.url(), z.literal('')])`) allows an empty
string. The write request's `z.url().optional()` requires a valid URL and rejects an empty
string. The backend can return an empty `backendUrl` (for example before the first save), but
the frontend never sends a blank URL in a write request.

#### `loadError` accepted but unpopulated

`BackendConfigSchema` includes `loadError: z.string().optional()`. The backend does not send the
field and no current producer populates it.

#### API key form mapping

`mapBackendConfigToBackendSettingsFormValues()` always sets `apiKey` to `''` so the masked
transport value never reaches a password input.
`mapBackendSettingsFormValuesToBackendConfigWriteInput()` includes `apiKey` only when the form
value is non-empty, preserving the stored key across a save that does not touch the field.
Because the form mapper omits a blank key and `BackendApiKeyWriteSchema` rejects an empty
string, the UI cannot clear a stored key; only a raw backend call sending an explicit
empty-string `apiKey` clears it.

#### `jsonDbRootFolderId` validation depth

Backend `CONFIG_SCHEMA` validation checks the format via regex and calls
`DriveApp.getFolderById()` to verify the folder exists. The frontend `isDriveFolderId` checks
only the identifier format. The frontend cannot replicate the Drive existence check without a
server round-trip, so the backend is the authoritative validator and the frontend catches only
format errors before submission.

#### Strict response schema

`BackendConfigSchema` is `.strict()`, so an unexpected backend field fails validation. The backend
response contains the fields documented in the read table. Adding a backend field without updating
the frontend schema rejects the entire `getBackendConfig` response, so both schemas must change in
lockstep.

#### authMode persistence row

The persistence-table `authMode` row documents the storage contract: the `'none'` rejection, the
legacy leniency and the accepted `googleGroups | scriptProperties` enum. `getAuthMode()` resolves
an absent `authMode` paired with a non-blank `authGroupEmail` to `googleGroups` (legacy leniency)
and resolves to `null` otherwise. The read transport does not emit `authMode`.

#### Locked-write failure reporting

`writeConfigurationLocked` throws errors carrying `code` (`CONFIG_LOCK_CONTENTION` /
`CONFIG_BLOB_TOO_LARGE`) and a `retriable` boolean. `commitBackendConfigPatch_()` catches
`CONFIG_LOCK_CONTENTION` and rethrows it as an `ApiRateLimitError`, so the dispatcher emits the
standard error envelope with `code: 'RATE_LIMITED'` and `isRetriable: true`. A client can
therefore distinguish retriable contention from a permanent validation rejection.
`CONFIG_BLOB_TOO_LARGE` surfaces through the aggregate `{ success: false, error }` string without
`code`/`retriable`, so the client shrinks the payload and retries the write with storage unchanged.

#### Aggregate-error redaction

The write transport appends `` `${name}: ${error?.message ?? 'REDACTED'}` `` for each field that
fails `preparePropertyValue` in `stageBackendConfigPatch_()` (`apiConfig.js`). The
non-contention locked-write failure path in `commitBackendConfigPatch_()` wraps the patch keys in
the same aggregate string. Validator messages are generic domain messages that never echo the
raw input value, so no credential reaches the client; the API-key validator returns a format
message, not the supplied token. The auth-field rejection is a transport-shape violation and
produces no aggregate.

#### Non-empty string schema

`backendConfiguration.zod.ts` defines `NonEmptyStringSchema` as `z.string().min(1)` and applies it
to `jsonDbMasterIndexKey` and `jsonDbLogLevel` in both `BackendConfigSchema` and
`BackendConfigWriteInputSchema`, matching the backend `CONFIG_SCHEMA` rules
(`Validate.validateNonEmptyString` / `validateLogLevel_`).

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
