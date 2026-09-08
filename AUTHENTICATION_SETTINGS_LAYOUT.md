# Authentication Settings Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and
user-visible states for the **Authentication settings surface** — the new admin-gated
settings tab for managing the authentication provider and authorised users, plus the
auth-gate deny states the frontend renders from `getApplicationAccess`.

Use it alongside:

- `SPEC.md` — domain rules, contracts, bootstrap, and scope boundaries
- `ACTION_PLAN.md` — implementation sequencing
- `docs/developer/data-shapes/auth-users.md` — canonical endpoint shapes
- `docs/developer/frontend/frontend-modal-patterns.md` — modal reuse rules
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md` — spacing tokens

This document is intentionally UI-focused. It does not replace the underlying feature
spec, backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. the new Settings page tab and its internal region hierarchy
2. the major visible regions inside the tab
3. the preferred UI components for each region
4. the user-visible states of the tab and its modal workflow
5. the application-level auth gate states driven by `getApplicationAccess`
6. responsive, accessibility, and motion expectations where they affect layout behaviour

This document does **not** redefine:

- backend contracts already settled in `SPEC.md` (bootstrap, revision guard, provider
  switch validation)
- rollout or sequencing decisions already settled in `ACTION_PLAN.md`
- shared frontend policies already defined in canonical developer docs

## Design principles

1. Keep the Settings page composition thin; the tab owns its state via a feature hook.
2. Preserve the existing Settings page tab navigation model — this feature adds one tab,
   it does not introduce nested navigation.
3. One visible layout per mode: the tab shows either Google Groups configuration or
   Script Properties configuration, never both simultaneously.
4. Use built-in Ant Design behaviours (Table editing patterns, Popconfirm, Modal) before
   creating bespoke interaction patterns.
5. Keep admin status, revision conflicts, and save outcomes visible without forcing the
   user into a secondary workflow.
6. Favour layouts that remain understandable on smaller screens and in reduced-motion mode.
7. The tab is **admin-only**: ordinary users do not see it. `SettingsPage` gates tab
   visibility on the access role delivered through a context provided by
   `AppAuthGate` (see "Auth gate states" and "Role delivery").

## Ant Design references consulted

- [Tabs](https://ant.design/components/tabs) — Settings page tab addition
- [Card](https://ant.design/components/card) — region containers, matching `SettingsSectionCard`
- [Form](https://ant.design/components/form) — provider configuration and add-user inputs
- [Table](https://ant.design/components/table) — authorised-user list (small N; local data, no server pagination)
- [Select](https://ant.design/components/select) — auth mode and role selection
- [Input](https://ant.design/components/input) — email entry
- [Popconfirm](https://ant.design/components/popconfirm) — lightweight remove-row confirmation
- [Modal](https://ant.design/components/modal) — mode-switch confirmation (confirm-loading pattern)
- [Alert](https://ant.design/components/alert) — blocking failures and warning summaries
- [Result](https://ant.design/components/result) — full-page gate blocking states (established `AppAuthGate` treatment)
- [Skeleton](https://ant.design/components/skeleton) — initial loading
- [Empty](https://ant.design/components/empty) — empty user list
- [Flex](https://ant.design/components/flex) / [Space](https://ant.design/components/space) — arrangement

## Surface hierarchy

```text
Settings page (existing Tabs)
└── "Authentication" tab  (admin-only; hidden for non-admin roles)
    ├── Status stack (refresh notice, save error, conflict warning)
    ├── Provider configuration card
    │   ├── Auth mode Select
    │   ├── Google Groups fields (group email) — when mode is googleGroups
    │   └── Script Properties fields (user table) — when mode is scriptProperties
    ├── Mode-switch confirmation Modal (secondary workflow)
    └── Save button (single save for the whole tab)
```

This tab is the **only** supported entry point for authentication management. No
alternative entry points (header menus, dashboard shortcuts, deep links) may be added.

## No extra navigation layers

The tab avoids nested tabs, nested routes, accordions-as-navigation, or other secondary
structure. Mode selection swaps visible regions inside one card; it does not navigate.

Rationale:

- Two providers with at most two fields each do not justify sub-navigation.
- The staged-list save model needs all candidate state visible at once for review.
- Fewer layers keep the revision-guard save model (one Save for the whole tab) legible.

## Outer layout

```text
"Authentication" tab
└── Flex column (gap: APP_GAP_LG; matches BackendSettingsPanel container pattern)
    ├── Status stack (Alerts / refresh notice)
    └── Form (layout="vertical"; single form instance for the whole tab)
        ├── Card: "Authentication provider"
        │   ├── Form.Item: Authentication mode (Select)
        │   ├── [googleGroups] Form.Item: Auth group email (Input type="email")
        │   └── [scriptProperties] Authorised users region (Table + add-user row)
        └── Form.Item: Save button (primary, htmlType="submit")
```

The status stack sits outside the `Form` and the single `Form` wraps the provider
card content and the Save `Form.Item` (mirroring `BackendSettingsPanel`'s
single-Form/single-submit pattern) so the primary button submits via
`htmlType="submit"`; the Save button is not a sibling outside the `Form`.

## Recommended top-level UI components

### 1. `Card` (region container)

Use `Card` for:

- the provider configuration card, reusing the existing `SettingsSectionCard` heading
  pattern (`Title level={3}`) so the tab visually matches the Backend tab.

Reason:

- consistent with the existing settings surface; free semantic heading structure.

### 2. `Table` (authorised-user list)

Use `Table` for:

- the staged authorised-user list in Script Properties mode.

Reason:

- structured rows (email, role, actions) with built-in empty state and accessible
  table semantics; user lists are small (school staff), so client-side data with
  `pagination={false}` is appropriate.

### 3. `Modal` (mode-switch confirmation)

Use `Modal` for:

- confirming an authentication mode change before it is staged.

Reason:

- the change alters who can access the application; a modal (not Popconfirm) gives
  room to explain consequences, and `confirmLoading` is the established save pattern.

## Region-by-region design

## 1. Status stack

### Components

- `Alert` (error) — load failure, save failure
- `Alert` (warning) — stale-revision conflict
- secondary `Text` — refresh notice (existing `backendSettingsRefreshStatusCopy` pattern)

### Content

- Load failure: blocking error alert naming the failed read.
- Save failure: backend aggregate/validation error message (no raw secrets).
- Stale revision: warning alert explaining that another admin saved first, with copy
  instructing the user to review and re-save; the staged list is kept, not reset.

### States

1. **Initial loading** — no status stack; card shows skeleton.
2. **Ready** — empty; status stack renders nothing.
3. **Warning** — stale-revision alert visible until the next successful save or reload.
4. **Blocking failure** — load error replaces the tab content with a single error Alert
   wrapped in the standard tab `Card` (with `role="region"` and the
   `settings-tab-panel` class, matching `BackendSettingsPanel`'s load-error treatment).

### Notes

- Errors are never transient-only: save and conflict errors persist in the status stack
  until resolved or superseded (no `message` toast as the sole surface).

## 2. Provider configuration card

### Components

- `Form` (vertical layout, one form instance for the whole tab)
- `Form.Item` + `Select` — Authentication mode (`googleGroups` | `scriptProperties`;
  no `'none'` option)
- `Form.Item` + `Input` (type="email") — Auth group email (groups mode only;
  compulsory-once-set guard identical in behaviour to the existing Backend panel guard)
- `Table` + add-user row (scriptProperties mode only) — see region 3

### Content

- Mode helper text: explains the selected mode in one sentence (Google Group membership
  vs saved user list with roles).
- Groups mode additionally renders a static note: membership is managed in Google
  Groups; the app-managed user list does not apply.
- Groups mode shows the current group email with the compulsory-once-set rule
  ("cannot be cleared once set") as field-level helper text, enforced by a new
  auth-form guard mirroring the behaviour the Backend panel guard had before auth
  fields were removed from it.

### Recommended structure

```text
Provider configuration card
├── Authentication mode (Select)
├── [googleGroups]
│   ├── Auth group email (Input)
│   └── Static membership note (Text type="secondary")
└── [scriptProperties]
    └── Authorised users region (Table + add row)
```

### States

1. **Initial loading** — `Skeleton` inside the card; inputs hidden.
2. **Ready (groups mode)** — mode Select + group email field + note; user region hidden.
3. **Ready (scriptProperties mode)** — mode Select + user region; email field hidden.
4. **Mode switch staged** — switching the Select opens the confirmation Modal (see
   Workflow 1); on confirm the visible regions swap; on cancel the Select reverts.
5. **Mutation in progress** — Save button `loading`; all inputs disabled.

### Notes

- Mode switching is staged client-side until Save; nothing is written by the Select.
- The mode Select never offers `'none'`.

## 3. Authorised users region (scriptProperties mode)

### Components

- `Table` (`rowKey` = email; `pagination={false}`; `locale.emptyText` = explanatory copy)
- `Select` (admin | user) as the inline editing control in the Role column
- `Input` (type="email") + `Select` (role) + `Button` "Add" — add-user row above the table
- `Popconfirm` + `Button` (danger, text) — per-row remove action
- `Empty` — via Table's built-in empty state

### Recommended structure

```text
Authorised users region
├── Add-user row (Input email + Select role + Add button) — Flex row, wraps on narrow widths
└── Table
    ├── Column: Email (text)
    ├── Column: Role (inline Select)
    └── Column: Actions (Popconfirm-wrapped Remove button)
```

### Recommended columns, fields, or cards

1. **Email** — lowercased trimmed address; plain text.
2. **Role** — inline `Select` with options `admin` / `user`; changing it stages the change.
3. **Actions** — Remove (`Popconfirm`: "Remove <email> from authorised users?").

### States

1. **Ready with data** — one row per staged user; the caller's own row is rendered
   normally (self-removal/demotion is allowed to stage; the server rejects commits
   that would leave zero admins and the error surfaces in the status stack).
2. **Ready with no data** — Table empty state with copy explaining that at least one
   admin is required before saving (reachable only while staging a provider switch).
3. **Duplicate add attempted** — add button disabled or field error when the email
   already exists in the staged list; no duplicate rows are ever rendered.
4. **Mutation in progress** — add/remove/role controls disabled during save.
5. **Post-mutation (save success)** — staged list becomes the baseline; revision
   updated from the response; controls re-enabled.

### Notes

- The staged list is plain client state derived from `getAuthenticationSettings`;
  discarding unsaved changes happens only via reload or successful save rebase.
- Email normalisation (trim, lowercase) happens on add, mirroring the backend rule.

## Workflow surfaces

## Mode-switch confirmation

### Surface type

- `Modal` (centered, with `confirmLoading` during save-in-progress is **not** used here —
  the modal only stages the switch; it closes immediately on confirm).

### Trigger

- User changes the Authentication mode `Select` while the current selection differs
  from the baseline mode.
- Eligibility: admin-only tab, so always eligible within the tab.

### Components

- `Modal` with `title` "Change authentication mode?"
- Body: consequence copy naming the target mode — e.g. switching to Script Properties:
  "Access will be verified against the authorised user list below; your admin access
  must be present in that list or the save will be rejected." Switching to Google
  Groups: "Access will be verified against membership of the Google Group; your admin
  status must come from a fresh group role lookup or the save will be rejected."
- Footer: `Cancel` (default) and `Confirm switch` (primary).

### Layout structure

```text
Mode-switch Modal
├── Consequence copy (per target mode)
└── Footer actions (Cancel / Confirm switch)
```

### States

1. **Closed** — default; Select changes stage directly when target equals baseline.
2. **Open and ready** — consequence copy rendered; focus lands on the Cancel button.
3. **Validation failure** — not applicable inside the modal; failures surface in the
   status stack after Save.
4. **Completed** — modal closes; visible regions swap to the target mode; the staged
   candidate list is seeded from the current baseline list (empty when none exists).

### Notes

- Only one modal may be open at a time; it must not stack over another modal.
- Destructive-action copy rule: the modal states consequences factually; it never
  claims the save has already happened.

## Global state rules

### Blocking error state

- Load failure of `getAuthenticationSettings`: the tab renders a single error `Alert`
  (no interactive controls), matching the existing Backend panel load-error treatment.
- Application-level `brokenConfig` / `denied` (from `getApplicationAccess`): rendered by
  the auth gate, not the tab — see "Auth gate states" below.

### Partial-load state

- Not applicable: the tab has a single read; it either loads or blocks.

### Empty state

- Empty staged user list: Table empty state explains the at-least-one-admin rule.
- Fresh install (claimable caller): the claim happens server-side on the first
  `getApplicationAccess` call, so the user sees the claimed admin state without a
  distinct surface.

### Success and mutation feedback

- Successful save rebases the staged list and revision and shows a transient success
  message via the `App.useApp()` message instance
  (`message.success('Authentication settings saved.')`), matching the context-aware
  pattern in `useBackendSettings` (never the static `message` API).
- Save failures and revision conflicts, by contrast, persist in the status stack (see
  region 1) because they require user action.
- The refresh notice ("Refreshing authentication settings...") uses the existing
  secondary-text pattern with accessible status semantics.

## Auth gate states (application level)

### Role delivery

`AppAuthGate` remains the owner of the access query. It consumes a new
`useApplicationAccess` hook (React Query, shared query-key factory) wrapping the
gate-exempt `getApplicationAccess` endpoint, and mounts an
`ApplicationAccessContext.Provider` around its children subtree, providing the
resulting access state — at minimum `{ role, reason }`. `SettingsPage` (a descendant
of that subtree) consumes the context to gate the Authentication tab's visibility; it
must not issue a second `getApplicationAccess` query. The existing OAuth gate
(`useAuthorisationStatus`) continues to run first as today; `getApplicationAccess`
layers on top of it, supplying `role`/`reason` for tab visibility and the
`brokenConfig`/`denied`/`freshInstall` gate states. The OAuth mechanism and
application access remain disjoint mechanisms, per `SPEC.md`.

The group-membership **gating** role of the gate's mode-dependent warm-up is
superseded by `getApplicationAccess`, which resolves access and role server-side in
one call for both providers. The **data-prefetch** warm-up described by the React
Query policy is a separate concern and is retained unchanged.

### Visible states

The existing fail-closed `AppAuthGate` full-page blocking treatment (`Result`) is
kept — the loading-and-width standards explicitly permit `Result` for full-page
blocking states, and it is the established pattern:

1. **`reason: 'ok'`** — normal render; `role` drives settings-tab visibility
   (`admin` shows the Authentication tab; `user` does not).
2. **`reason: 'freshInstall'`** — a claimable caller never sees this state: the same
   call claims and returns `reason: 'ok'`. Only callers who cannot claim (blank
   resolved email) surface it, as a blocking `Result` state explaining that the
   application is not yet configured and their identity could not be resolved, with
   no interactive application content.
3. **`reason: 'brokenConfig'`** — blocking `Result` state stating that the
   authentication configuration is invalid and must be repaired by a script editor
   (manual recovery path), with no interactive application content.
4. **`reason: 'denied'`** — blocking `Result` state stating the caller is not
   authorised, with no interactive application content.

Panel-level errors inside the Authentication tab (load failure of
`getAuthenticationSettings`) remain top-of-tab `Alert` treatments — the `Result`
treatment applies only to the full-page gate states. Both are persistent surfaces;
neither uses toasts as the sole surface.

## Responsive behaviour

- The tab content inherits the standard settings panel width tokens (consistent with
  the other Settings tabs per the loading-and-width standards); no feature-local width
  literals.
- The add-user row wraps (Flex wrap) on narrow widths; inputs keep a minimum usable
  width rather than collapsing.
- The user table lets long email addresses wrap; horizontal scrolling is preferred over
  truncation-with-tooltip for email content.
- Status stack alerts span the full tab width at all breakpoints.
- The mode-switch Modal is centered and width-constrained; its copy reflows naturally.

## Accessibility and motion

- The refresh notice and busy saves expose explicit accessible status/busy semantics
  (`role="status"` / `aria-busy`), matching the existing Backend panel pattern.
- Popconfirm and Modal follow Ant Design keyboard interaction defaults; the mode-switch
  Modal opens focus on Cancel and returns focus to the mode Select on close.
- Role information is always visible as a select value (never tooltip-only).
- No motion beyond Ant Design defaults; nothing custom is introduced, so reduced-motion
  defaults apply unchanged.
- Full-page gate blocking states use the accessible structure of `Result` (status icon
  - title + extra copy) so screen readers announce them; panel-level alerts use `Alert`
    semantics.

## Implementation guardrails

- Do not introduce alternative entry points to the Authentication tab.
- Do not duplicate domain rules here that belong in `SPEC.md` (bootstrap, revision
  semantics, candidate validation).
- Do not add bespoke layout abstractions when existing Ant Design primitives suffice.
- Do not hide save, conflict, or load errors inside transient surfaces only.
- Do not add `'none'` to the mode options or render both provider regions at once.
- Keep spacing on the 8px grid using shared tokens (no feature-local literals).

## Open questions

None — placement, editing model, and mode-switch treatment were confirmed with the
product owner; remaining details follow existing app patterns.
