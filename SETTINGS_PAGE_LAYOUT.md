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
6. Prefer a single visible form with clear sections over nested tabs, to avoid hidden-field validation problems.

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
                    ├── Save button
                    └── Optional reset/reload button

Proposed frontend file structure
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
Notes
SettingsPage.tsx should remain a composition layer only.

BackendSettingsPanel.tsx should focus on rendering.

useBackendSettings.ts should own:

loading current config

preparing form initial values

mapping form values to write payload

calling getBackendConfig() and setBackendConfig()

handling success and error feedback

backendSettingsForm.zod.ts should be the canonical frontend validation schema.

Ant Design components to use
1. Form
Use Form as the primary interaction container.

Why
central field registration

inline validation feedback

submit handling

form-wide disabled/loading state

strong compatibility with Ant Design inputs

Planned usage
Form.useForm()

layout="vertical"

onFinish

onFinishFailed

requiredMark

2. Card
Use Card for visual section grouping.

Planned grouping
outer page card or panel wrapper

inner cards for:

Backend

Advanced

Database

Why
cleaner than nested tabs

keeps all fields visible during validation

simpler page scanning

3. Input.Password
Use for apiKey.

Why
communicates sensitivity clearly

appropriate for a secret-like value

avoids showing the existing value in plain text

Behaviour
never prefill with the masked backend value

if a key already exists:

leave the field blank

show helper text or placeholder indicating a stored key exists

if the field is left blank when a key already exists:

omit apiKey from the save payload

if no key exists:

require a non-empty API key

4. Input
Use for plain string fields:

backendUrl

jsonDbMasterIndexKey

jsonDbRootFolderId

Why
single-line text entry

straightforward integration with Form.Item

suitable for custom schema validation

5. InputNumber
Use for bounded integer fields:

backendAssessorBatchSize

slidesFetchBatchSize

daysUntilAuthRevoke

jsonDbLockTimeoutMs

Why
correct numeric affordance

built-in min/max UI hints

easier to use than free text for numeric configuration

Planned props
precision={0}

min

max

full width styling where needed

Validation note
Do not rely on InputNumber alone for validation. Final validation still belongs in the Zod schema and backend configuration manager.

6. Select
Use for jsonDbLogLevel.

Options
DEBUG

INFO

WARN

ERROR

Why
fixed set of values

prevents typo-based invalid input

mirrors backend-supported values

7. Switch
Use for boolean settings:

jsonDbBackupOnInitialise

optionally revokeAuthTriggerSet if that remains editable in the new UI

Important form binding detail
Use:

<Form.Item name="jsonDbBackupOnInitialise" valuePropName="checked">
Why
Switch binds on checked, not value.

8. Alert
Use Alert for persistent inline messages.

Planned uses
top-of-form warning when loadError is returned from getBackendConfig()

save failure summaries that need to remain visible while the user corrects issues

optional informational note about API key behaviour

Types
warning for partial-load issues

error for save problems

info for guidance copy if needed

9. App.useApp() with message and notification
Use context-aware Ant Design feedback APIs.

message
Use for short, direct-action feedback:

successful save

possibly simple save failure

notification
Use only when failure details are richer and need more space.

Why
These APIs respect app context and theme, and fit the repo’s feedback guidance better than static calls.

10. Button
Use:

primary Save button

optional secondary Reset or Reload button

Planned behaviour
htmlType="submit" for Save

loading while save is in progress

11. Skeleton
Use for first-load placeholder rendering before the config payload is available.

Why
more natural for page-load UX than a blocking spinner

shows users the intended page structure immediately

12. Space, Row, Col, and/or Flex
Use these layout helpers for spacing and responsive form arrangement.

Planned layout approach
two columns for wider screens where appropriate

stacked layout on narrower screens

action row aligned consistently beneath the section cards

Field-to-component mapping
Setting field	Component	Notes
apiKey	Input.Password	blank value with masked helper text if already stored
backendUrl	Input	strict custom HTTPS validation
backendAssessorBatchSize	InputNumber	integer 1–500
slidesFetchBatchSize	InputNumber	integer 1–100
daysUntilAuthRevoke	InputNumber	integer 1–365
jsonDbMasterIndexKey	Input	required non-empty
jsonDbLockTimeoutMs	InputNumber	integer 1000–600000
jsonDbLogLevel	Select	enum value
jsonDbBackupOnInitialise	Switch	checked binding
jsonDbRootFolderId	Input	optional, validate only when populated
Validation model
Frontend validation source of truth
Create a dedicated adjacent schema file:

src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts
The frontend form schema should enforce at least the following:

backendUrl

required

trimmed

HTTPS only

no whitespace

no localhost

no IPv4 literal host

hostname must be structurally valid

backendAssessorBatchSize

integer between 1 and 500

slidesFetchBatchSize

integer between 1 and 100

daysUntilAuthRevoke

integer between 1 and 365

jsonDbMasterIndexKey

required non-empty string

jsonDbLockTimeoutMs

integer between 1000 and 600000

jsonDbLogLevel

one of DEBUG, INFO, WARN, ERROR

jsonDbRootFolderId

optional

must match expected Drive identifier format when supplied

apiKey

required only when no backend key already exists

Validation strategy
Validation should happen in three layers:

Ant Design field integration and inline error rendering

Zod schema validation in the frontend feature layer

Existing backend configuration validation in the configuration manager

Data flow
Read flow
BackendSettingsPanel mounts

useBackendSettings calls getBackendConfig()

response is parsed through the existing frontend service schema

hook maps backend payload into form initial values

loadError, if present, is rendered as an inline Alert

Write flow
user edits fields

user clicks Save

form values are normalised and validated against the dedicated settings Zod schema

hook maps values to BackendConfigWriteInput

setBackendConfig() is called

success uses message.success

failure uses inline Alert and, if needed, notification.error

API key handling rules
The API key field needs special handling.

Read
do not populate the input with the masked backend value

use hasApiKey to determine whether a stored key exists

show masked state only as explanatory helper text or placeholder

Write
if the user enters a value, send it as the new API key

if the user leaves the field blank and a stored key exists, omit apiKey

if explicit clearing remains supported, handle that deliberately rather than accidentally

Error and feedback behaviour
Persistent inline feedback
Use Alert for:

partial configuration load warnings

non-field save failures

any guidance the user may need while editing

Transient feedback
Use message.success for successful saves.

Logging
Keep raw technical details out of user-facing copy. Any developer diagnostics should remain in frontend logging utilities and should not expose secrets.

Why not nested tabs inside Backend settings
The legacy modal used tabs partly because it lived in a constrained dialog.

For the new page:

nested tabs would add complexity

they would reintroduce hidden-field validation problems

cards and vertical sections provide a simpler, clearer layout

the page already has a top-level tab system

Accessibility and usability expectations
every field must have a visible label

validation errors should be inline and linked to the correct field

the first invalid field should be focused or scrolled into view on submit failure

the save action should expose a visible loading state

section boundaries should be visually and semantically clear

Testing expectations
The new backend settings page introduces visible interactions, so both test layers are needed.

Vitest + Testing Library
Cover:

initial load state

field rendering from backend data

API key masking behaviour

payload mapping

validation logic

save success/failure state handling

Playwright
Cover:

navigating to Settings

selecting Backend settings

editing fields

seeing inline validation

saving successfully

seeing save failure feedback when appropriate

Summary
The recommended implementation is a sectioned Ant Design page-based form using:

Form

Card

Input.Password

Input

InputNumber

Select

Switch

Alert

Button

Skeleton

App.useApp() with message and optionally notification

This keeps the implementation simple, accessible, and aligned with both the active frontend architecture and the legacy configuration feature set.
