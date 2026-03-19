# Settings Component Layout Proposal

## Purpose

This document proposes the component layout for the new **Backend settings** page under the active frontend **Settings** page.

The goal is to replace the current placeholder backend settings tab with a proper Ant Design form that is equivalent in scope to the legacy `UIManager` configuration modal, while improving layout, accessibility, and validation behaviour.

## Design principles

1. Keep the existing top-level **Settings** page tab structure.
2. Replace the **Backend settings** placeholder with a dedicated feature component.
3. Use Ant Design components rather than recreating legacy modal patterns.
4. Keep async orchestration in a feature hook, not in `SettingsPage`.
5. Validate in the frontend with Zod and again in the backend via the existing configuration manager.
6. Prefer a single visible form with clear sections over nested tabs to avoid hidden-field validation problems.

## Constraints

1. Do not define a bespoke recovery path for configuration load failures in this iteration.
2. Allow `callApi(...)` to use its existing retry and exponential backoff behaviour; if configuration loading still fails after that, fail fast and surface the failure clearly for developer debugging.
3. Use a top-level `Alert` as the default failure state for this settings page rather than introducing a richer recovery flow for now.

## Proposed component tree

```text
SettingsPage
└── TabbedPageSection
    ├── Classes tab
    └── Backend settings tab
        └── BackendSettingsPanel
            ├── BackendSettingsLoadState
            ├── Alert (optional load warning)
            └── Form
                ├── BackendSettingsSectionCard
                │   ├── API key field
                │   └── Backend URL field
                ├── AdvancedSettingsSectionCard
                │   ├── Backend assessor batch size
                │   ├── Slides fetch batch size
                │   └── Days until auth revoke
                ├── DatabaseSettingsSectionCard
                │   ├── JSON DB master index key
                │   ├── JSON DB lock timeout
                │   ├── JSON DB log level
                │   ├── JSON DB backup on initialise
                │   └── JSON DB root folder ID
                └── FormActions
                    └── Save button
```

## Proposed frontend file structure

```text
src/frontend/src/
  features/
    settings/
      backend/
        BackendSettingsPanel.tsx
        BackendSettingsPanel.spec.tsx
        useBackendSettings.ts
        useBackendSettings.spec.ts
        backendSettingsForm.zod.ts
        backendSettingsFormMapper.ts
        backendSettingsFields.ts
```

### Notes

- `SettingsPage.tsx` should remain a composition layer only.
- `BackendSettingsPanel.tsx` should focus on rendering.
- `useBackendSettings.ts` should own:
  - loading current config
  - preparing form initial values
  - mapping form values to the write payload
  - calling `src/frontend/src/services/backendConfigurationService.ts`, which in turn uses `callApi('getBackendConfig')` and `callApi('setBackendConfig', parsedInput)` through the shared `apiHandler` transport rather than calling backend globals directly
  - handling success and error feedback
- `backendSettingsForm.zod.ts` should be the canonical frontend validation schema.
- Ant Design `App.useApp()` requires an `App` provider in the root shell, so the implementation should add that wrapper before the settings feature uses context-aware `message` or `notification`.
- Use React Query for the backend configuration read path only. Keep form editing local to the panel and perform writes through the existing service layer, followed by a query-driven refresh.

### Suggested hook state matrix

Use a small explicit state model in `useBackendSettings.ts` so the React flow stays idiomatic and testable:

- `isInitialLoading`
  - `true` while the first `getBackendConfig()` request is in flight through the feature's React Query read path
  - renders the initial `Skeleton` state rather than the editable form
- `loadError`
  - stores the current blocking load failure message when the initial read fails completely
  - renders a top-level `Alert`
- `partialLoadError`
  - stores backend `loadError` warnings when the payload is present but incomplete
  - keeps the form visible but blocks saving
- `isSaveBlocked`
  - derived from `partialLoadError !== null || loadError !== null`
  - disables submit affordances while keeping failure visible
- `isSaving`
  - `true` only while `setBackendConfig()` is in flight
  - drives Ant Design loading/disabled affordances rather than custom spinners
- `saveError`
  - stores the latest save failure after transport/domain error mapping
  - renders as persistent inline feedback until the next successful save or reload
- `hasApiKey`
  - derived from the read payload and used only for API key UX/validation branching

Suggested transitions:

1. `isInitialLoading` → success: form becomes editable.
2. `isInitialLoading` → hard failure: show top-level `Alert`, hide or disable the form, fail fast.
3. successful read with backend `loadError`: show warning `Alert`, render the form, set `isSaveBlocked=true`.
4. save submit: set `isSaving=true`, clear stale save error, keep load errors intact.
5. successful save: show `message.success`, then re-fetch current config from the backend and rebase the form from the fresh payload with `form.setFieldsValue(...)`.
6. failed save: set `saveError`, keep the current form values visible, and clear `isSaving`.

### Read/edit ownership model

Use a simple hybrid model for this feature:

- React Query owns backend configuration reads and refreshes
- `useBackendSettings.ts` adapts the query result into the feature state model
- `BackendSettingsPanel.tsx` owns the Ant Design `FormInstance` and local edit state
- when a fresh payload arrives after initial load or successful save, the panel re-bases the form with `form.setFieldsValue(...)`
- do not introduce a keyed remount or other fallback rebase mechanism in this iteration

This keeps prefetch and query lifecycle support available without moving the user's in-progress edits into shared cache state.

## Ant Design components to use

### 1. [Form](https://ant.design/components/form/)

Use `Form` as the primary interaction container.

**Why**

- central field registration
- inline validation feedback
- submit handling
- form-wide disabled/loading state
- strong compatibility with Ant Design inputs

**Planned usage**

- `Form.useForm()`
- `name`
- `layout="vertical"`
- `onFinish`
- `onFinishFailed`
- `requiredMark`
- `scrollToFirstError={{ focus: true }}`

### 2. [Card](https://ant.design/components/card/)

Use `Card` for visual section grouping.

**Planned grouping**

- outer page card or panel wrapper
- inner cards for:
  - Backend
  - Advanced
  - Database

**Why**

- cleaner than nested tabs
- keeps all fields visible during validation
- simpler page scanning

### 3. [Input.Password](https://ant.design/components/input/)

Use `Input.Password` for `apiKey`.

**Why**

- communicates sensitivity clearly
- appropriate for a secret-like value
- avoids showing the existing value in plain text

**Behaviour**

- Never prefill with the masked backend value.
- If a key already exists:
  - leave the field blank
  - show helper text or a placeholder indicating a stored key exists
- If the field is left blank when a key already exists:
  - omit `apiKey` from the save payload
- If no key exists:
  - require a non-empty API key

### 4. [Input](https://ant.design/components/input/)

Use `Input` for plain string fields:

- `backendUrl`
- `jsonDbMasterIndexKey`
- `jsonDbRootFolderId`

**Why**

- single-line text entry
- straightforward integration with `Form.Item`
- suitable for custom schema validation

### 5. [InputNumber](https://ant.design/components/input-number/)

Use `InputNumber` for bounded integer fields:

- `backendAssessorBatchSize`
- `slidesFetchBatchSize`
- `daysUntilAuthRevoke`
- `jsonDbLockTimeoutMs`

**Why**

- correct numeric affordance
- built-in min/max UI hints
- easier to use than free text for numeric configuration

**Planned props**

- `precision={0}`
- `min`
- `max`
- full-width styling where needed

**Validation note**

Do not rely on `InputNumber` alone for validation. Final validation still belongs in the Zod schema and backend configuration manager.

### 6. [Select](https://ant.design/components/select/)

Use `Select` for `jsonDbLogLevel`.

**Options**

- `DEBUG`
- `INFO`
- `WARN`
- `ERROR`

**Why**

- fixed set of values
- prevents typo-based invalid input
- mirrors backend-supported values

### 7. [Switch](https://ant.design/components/switch/)

Use `Switch` for boolean settings:

- `jsonDbBackupOnInitialise`

**Important form binding detail**

Use:

```tsx
<Form.Item name="jsonDbBackupOnInitialise" valuePropName="checked">
```

**Why**

`Switch` binds on `checked`, not `value`.

### 8. [Alert](https://ant.design/components/alert/)

Use `Alert` for persistent inline messages.

**Planned uses**

- top-of-form warning when `loadError` is returned from the `backendConfigurationService.getBackendConfig()` read path
- save failure summaries that need to remain visible while the user corrects issues
- optional informational note about API key behaviour

**Types**

- `warning` for partial-load issues
- `error` for save problems
- `info` for guidance copy if needed

### 9. [App](https://ant.design/components/app/) with [message](https://ant.design/components/message/) and [notification](https://ant.design/components/notification/)

Use context-aware Ant Design feedback APIs via `App.useApp()`.

**`message`**

Use for short, direct-action feedback:

- successful save
- possibly simple save failure

**`notification`**

Use only when failure details are richer and need more space.

**Why**

These APIs respect app context and theme, and fit the repo’s feedback guidance better than static calls.

### 10. [Button](https://ant.design/components/button/)

Use:

- primary Save button

**Planned behaviour**

- `htmlType="submit"` for Save
- loading while save is in progress

### 11. [Skeleton](https://ant.design/components/skeleton/)

Use `Skeleton` for first-load placeholder rendering before the config payload is available.

**Why**

- more natural for page-load UX than a blocking spinner
- shows users the intended page structure immediately

### 12. Layout helpers: [Space](https://ant.design/components/space/), [Grid (`Row` / `Col`)](https://ant.design/components/grid/), and/or [Flex](https://ant.design/components/flex/)

Use these layout helpers for spacing and responsive form arrangement.

**Planned layout approach**

- two columns for wider screens where appropriate
- stacked layout on narrower screens
- action row aligned consistently beneath the section cards

## Field-to-component mapping

| Setting field              | Component        | Notes                                                 |
| -------------------------- | ---------------- | ----------------------------------------------------- |
| `apiKey`                   | `Input.Password` | Blank value with masked helper text if already stored |
| `backendUrl`               | `Input`          | Trimmed before validation; must be a valid URL        |
| `backendAssessorBatchSize` | `InputNumber`    | Integer `1–500`                                       |
| `slidesFetchBatchSize`     | `InputNumber`    | Integer `1–100`                                       |
| `daysUntilAuthRevoke`      | `InputNumber`    | Integer `1–365`                                       |
| `jsonDbMasterIndexKey`     | `Input`          | Required non-empty                                    |
| `jsonDbLockTimeoutMs`      | `InputNumber`    | Integer `1000–600000`                                 |
| `jsonDbLogLevel`           | `Select`         | Enum value                                            |
| `jsonDbBackupOnInitialise` | `Switch`         | `checked` binding                                     |
| `jsonDbRootFolderId`       | `Input`          | Optional; validate only when populated                |

`revokeAuthTriggerSet` should be removed from the UI entirely. It is a backend operational flag managed by initialisation routines rather than a user-facing setting, and should be treated as read-only by the frontend.

## Validation model

### Frontend validation source of truth

Create a dedicated adjacent schema file:

```text
src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts
```

The frontend form schema should enforce at least the following.

#### `backendUrl`

- required
- normalised by trimming before validation
- must be a valid URL using Zod URL validation

#### `backendAssessorBatchSize`

- integer between `1` and `500`

#### `slidesFetchBatchSize`

- integer between `1` and `100`

#### `daysUntilAuthRevoke`

- integer between `1` and `365`

#### `jsonDbMasterIndexKey`

- required non-empty string

#### `jsonDbLockTimeoutMs`

- integer between `1000` and `600000`

#### `jsonDbLogLevel`

- one of `DEBUG`, `INFO`, `WARN`, `ERROR`

#### `jsonDbRootFolderId`

- optional
- must match the expected Drive identifier format when supplied

#### `apiKey`

- required only when no backend key already exists

### Consistency recommendations for the validation layers

Keep the three validation layers aligned but distinct:

1. `backendConfiguration.zod.ts` should remain the transport schema for the backend configuration read/write payload shape.
2. `backendSettingsForm.zod.ts` should own user-input validation, normalisation, and form-specific rules such as conditional API key requirements.
3. The backend `ConfigurationManager` remains the final authority for persisted configuration validation.

To keep these layers as consistent as possible:

- reuse the same field names and enum values across all layers
- mirror backend numeric limits exactly in the form schema
- normalise `backendUrl` by trimming before frontend form validation so user input is handled consistently
- use Zod URL validation for `backendUrl` in both the transport schema and the form schema so frontend reads and writes share one URL contract
- keep form-only concerns, such as `hasApiKey`-driven conditional requirements, out of the transport schema
- keep transport-only concerns, such as masked read payloads and write result envelopes, out of the form schema
- prefer shared frontend error contracts and shared transport/domain mapping utilities where the behaviour is generic
- add a backend-settings-specific error mapper only if this feature introduces genuinely unique error semantics that would make a shared mapper noisy or misleading
- add mapper tests that prove form values translate cleanly into `BackendConfigWriteInput`

### Backend URL hardening follow-up

The frontend URL contract should move ahead with Zod URL validation for both transport parsing and form validation.

The backend validator should then be hardened in a follow-on task so `Validate.validateUrl(...)` and the configuration manager enforce the same valid-URL contract, with matching backend transport tests.

### Validation strategy

Validation should happen in three layers:

1. Ant Design field integration and inline error rendering.
2. Zod schema validation in the frontend feature layer.
3. Existing backend configuration validation in the configuration manager.

## Data flow

### Read flow

1. `BackendSettingsPanel` mounts.
2. `useBackendSettings` starts the React Query-backed read using `backendConfigurationService.getBackendConfig()`.
3. The response is parsed through the existing frontend service schema before it is exposed to the feature.
4. That service reads through `callApi('getBackendConfig')`, which routes via the shared frontend `apiHandler` transport path.
5. If the request fails completely after `callApi(...)` retry/backoff, the hook fails fast and renders a top-level `Alert`.
6. If the request succeeds, the hook maps the backend payload into form values for the panel.
7. Backend `loadError`, if present in an otherwise valid payload, is rendered as an inline warning `Alert`.
8. If backend `loadError` is present, saving is blocked until a future successful reload clears that condition.

### Write flow

1. The user edits fields.
2. The user clicks Save.
3. If the latest load produced `loadError`, the UI keeps the form in a blocked state with a persistent inline `Alert` and disabled submit affordances.
4. Form values are normalised and validated against the dedicated settings Zod schema.
5. The hook maps values to `BackendConfigWriteInput`.
6. `backendConfigurationService.setBackendConfig()` is called.
7. That service writes through `callApi('setBackendConfig', parsedInput)`, which routes via the shared frontend `apiHandler` transport path.
8. Success uses `message.success`.
9. After a successful save, the hook immediately re-fetches the current config from the backend and the panel re-bases the form from that fresh payload with `form.setFieldsValue(...)`.
10. Failure sets persistent save-error state and displays it as an inline `Alert`. `notification.error` should be used only if extra asynchronous context is genuinely needed.

## API key handling rules

The API key field needs special handling.

### Read

- do not populate the input with the masked backend value
- use `hasApiKey` (derived from the transport field `hasApiKey`) to determine whether a stored key exists
- show masked state only as explanatory helper text or placeholder

### Write

- if the user enters a value, send it as the new API key
- if the user leaves the field blank and a stored key exists, omit `apiKey`
- explicit API key clearing is out of scope for this UI; support replacement or retention only

### Frontend write payload rules

- only editable frontend fields should be emitted in the write payload
- `revokeAuthTriggerSet` is read-only and must never be sent from the feature
- `hasApiKey` and `loadError` are read-only transport fields and must never be sent from the feature
- masked read `apiKey` values must never be echoed back in writes
- `apiKey` remains a writable field, but only as an explicit replacement value supplied by the user

## Error and feedback behaviour

### Persistent inline feedback

Use `Alert` for:

- partial configuration load warnings
- non-field save failures
- any guidance the user may need while editing

### Default load failure state

Use a top-level `Alert` as the default hard-failure state when the initial configuration read fails completely. Do not add a bespoke recovery workflow in this iteration; allow the failure to surface clearly after the shared `callApi(...)` retry path is exhausted.

### Transient feedback

Use `message.success` for successful saves.

### Logging

Keep raw technical details out of user-facing copy. Any developer diagnostics should remain in frontend logging utilities and should not expose secrets.

### Error mapping recommendation

- transport or runtime failures should throw from the hook and be mapped to user-safe inline error copy in the component
- backend `{ success: false, error }` save responses should also be treated as failures and surfaced through the same inline error path
- technical details such as request identifiers or backend error codes should stay in logs rather than the rendered UI
- because the feature uses visible inline feedback, the error state should persist until the next successful load or save clears it

## Why not nested tabs inside Backend settings?

The legacy modal used tabs partly because it lived in a constrained dialog.

For the new page:

- nested tabs would add complexity
- they would reintroduce hidden-field validation problems
- cards and vertical sections provide a simpler, clearer layout
- the page already has a top-level tab system

## Accessibility and usability expectations

- every field must have a visible label
- validation errors should be inline and linked to the correct field
- the first invalid field should be focused or scrolled into view on submit failure
- the save action should expose a visible loading state
- section boundaries should be visually and semantically clear

## Testing expectations

The new backend settings page introduces visible interactions, so both test layers are needed.

### Vitest + Testing Library

Cover:

- initial load state
- hard load failure rendering as a top-level `Alert`
- blocked save state when `loadError` is present
- field rendering from backend data
- API key masking behaviour
- API key required state when no stored key exists
- form rebasing via `form.setFieldsValue(...)` after a successful refresh
- API key omission when a stored key exists and the field is left blank
- payload mapping
- validation logic
- full hook state transitions (`isInitialLoading`, `loadError`, `partialLoadError`, `isSaveBlocked`, `isSaving`, `saveError`)
- transport error mapping
- backend save failure mapping
- successful save followed by config re-fetch and form rebase
- save success/failure state handling
- top-level load error vs inline partial-load warning rendering
- first-invalid-field focus behaviour on submit failure
- error clearing behaviour after successful reload/save

### Playwright

Cover:

- navigating to Settings
- selecting Backend settings
- seeing the initial skeleton state before config is ready
- seeing a top-level `Alert` when the initial config read fails
- editing fields
- seeing inline validation
- keyboard-only entry and submission flow across the form
- focus moving to the first invalid field after a failed submit
- seeing save blocked when the page is in a partial-load error state
- leaving the API key blank when an existing key is present and still saving successfully
- seeing validation failure when no stored API key exists and the field is left blank
- saving successfully
- seeing the form refresh from the backend after a successful save
- seeing save failure feedback when appropriate

## Summary

The recommended implementation is a sectioned Ant Design page-based form using:

- `Form`
- `Card`
- `Input.Password`
- `Input`
- `InputNumber`
- `Select`
- `Switch`
- `Alert`
- `Button`
- `Skeleton`
- `App.useApp()` with `message` and, optionally, `notification`

This keeps the implementation simple, accessible, and aligned with both the active frontend architecture and the legacy configuration feature set.
