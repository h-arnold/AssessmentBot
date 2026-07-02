# Class Page Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and user-visible states for the **Class page** — the per-class overview surface that opens when a teacher clicks the `View` button on a class card in `ClassesPage`.

Use it alongside:

- `SPEC_CLASS_PAGE.md` — domain rules, contracts, and scope boundaries
- `SPEC_CLASS_PAGE_PREPARATION.md` — data analysis service contract, shared display helpers
- `ACTION_PLAN.md` — implementation sequencing
- `docs/developer/frontend/frontend-loading-and-width-standards.md` — loading states, skeleton patterns, width tokens
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md` — shell navigation conventions
- `docs/developer/frontend/frontend-modal-patterns.md` — modal reuse and extraction rules
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` — helper discovery

This document is intentionally UI-focused. It does not replace the underlying feature spec, backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. the page hierarchy for the class detail view (child of `ClassesPage`, not a top-level route)
2. the major visible regions inside the page surface
3. the preferred UI components for each region
4. the user-visible states of the main page surface
5. the user-visible states of the `AssessTaskModal` workflow surface
6. responsive, accessibility, and motion expectations where they affect layout behaviour

This document does **not** redefine:

- backend contracts already settled in `SPEC_CLASS_PAGE.md`
- rollout or sequencing decisions already settled in `ACTION_PLAN.md`
- shared frontend policies already defined in canonical developer docs

**Cross-doc note on `MetricPill` defaults:** The `MetricPill` error‑colour default lives in `resolveMetricTone` (`'volcano'`), not in `MetricPill` itself — `MetricPill` is a pass-through. The column filters on the metric columns do not pass an `errorColor`; they let the resolver's default flow through. The `onFilter` predicate uses `resolveMetricTone(record.metrics[columnKey], { lower: 0, upper: 5 }).color`, which returns `'volcano'` for `error` cells. The filter value set declares `'volcano'` as a literal, so the match is correct — but the colour source is `metricTone`, not the column‑filter list. Do not duplicate the default or introduce a second colour source.

## Design principles

1. Keep the owning page layer (`ClassesPage`) thin — it adds only `selectedClassId` state and a render branch.
2. Preserve the existing app navigation model — no new top-level nav key; the sidebar `Classes` entry stays highlighted.
3. Prefer one clear visible layout over nested inner tabs or layered navigation — the page is a single scrollable view of recent-assignment cards followed by a student-averages table.
4. Use built-in Ant Design behaviours before creating bespoke interaction patterns — the table, skeleton, card, breadcrumb, empty, result, and tag (MetricPill) all follow standard Ant Design v6 behaviour.
5. Keep important status, error, and selection state visible without forcing the user into a secondary workflow — blocking errors are full-page `Result` components, not hidden behind acknowledge modals.
6. Favour layouts that remain understandable on smaller screens and in reduced-motion mode — the card row wraps, the table scrolls horizontally, and the breadcrumb is static text.
7. Keep responsibilities clear between composition (`ClassPage`), state orchestration (`useClassPageData`), and presentational regions (`RecentAssignmentsSection`, `StudentAveragesTableCard`, etc.).

## Ant Design references consulted

- [Breadcrumb](https://ant.design/components/breadcrumb) — three-segment navigation, `items` prop with `onClick` on the clickable `Classes` segment
- [Card](https://ant.design/components/card) — up to three Recent Assignment cards (width 320px, `size="small"`) and one Student Averages `Card` (`size="small"`)
- [Table](https://ant.design/components/table) — Student Averages table with `pagination={false}`, `size="small"`, column-level `filters` and `sorter`, `onChange` sorter/filter mapping
- [Flex](https://ant.design/components/flex) — primary layout primitive for the heading row (left title + right actions), horizontal metric-pill rows inside `RecentAssignmentCard`, and the control row inside `StudentAveragesTableCard`
- [Space](https://ant.design/components/space) — horizontal grouping of header action buttons, vertical stacking of label + pill per metric cell
- [Result](https://ant.design/components/result) — full-page blocking error states (six error types, mapped to two `Result` status variants: `warning` for retryable and `error` for non‑retryable), replaces the default `Alert` pattern per documented deviation in `SPEC_CLASS_PAGE.md`
- [Skeleton](https://ant.design/components/skeleton) — shape-matched loading placeholder for the heading row, card row, and table region
- [Empty](https://ant.design/components/empty) — two empty states: recent assignments (zero assignments) and student-averages search (no matching students); `children` slot for the CTA button
- [Button](https://ant.design/components/button) — `Edit Student Details` (disabled, `type="default"`) and `Start New Assessment` (primary, `type="primary"`); empty-state CTA (primary)
- [Tag](https://ant.design/components/tag) — used by `MetricPill` (the shared display helper), not used directly in layout components; the `color` prop powers the RAG colour scheme
- [Typography](https://ant.design/components/typography) — `Title` for the page heading (level 2), `Text` for the page summary, the "Last Assessed" line, and the "Viewing: Overall Class Averages" label. Section labels (Recent Assignments, Student Averages) live in their respective `Card` `title` props, not as standalone `Typography.Title` elements.
- [Tooltip](https://ant.design/components/tooltip) — "Coming soon" on the disabled `Edit Student Details` button; wrapped via a `span` because Ant Design v6 `Tooltip` does not trigger on a disabled `Button` directly
- [Input.Search](https://ant.design/components/input) — student-name search in the Student Averages table control row
- [Modal](https://ant.design/components/modal) — `AssessTaskModal` is a pre-existing feature-scoped modal (not part of this layout spec's design); its open/close state is owned by the page composition root
- [Result status variants](https://ant.design/components/result) — `status="warning"` for retryable errors, `status="error"` for non-retryable errors

## Surface hierarchy

```text
pages/ClassesPage.tsx                          ← thin shell; adds selectedClassId + render branch
└── (when selectedClassId !== null)
    └── features/classPage/ClassPage.tsx        ← composition root
        ├── [Breadcrumb]                       ← three-segment: AssessmentBot Frontend / Classes / {className}
        ├── [Heading + Header Actions]         ← Flex row: page heading (left) + ClassPageHeaderActions (right)
        ├── [RecentAssignmentsSection]         ← Ant Design Card (size="small", title="Recent Assignments") wrapping the card row (or empty state)
        │   └── [RecentAssignmentCard]×3 max   ← Ant Design Card, width 320px, containing 4 MetricPill cells (nested inside the section Card)
        ├── [StudentAveragesTableCard]         ← Ant Design Card wrapping Input.Search + static label + Ant Design Table
        │   ├── [Control row]                  ← Flex: Input.Search (left) + "Viewing: Overall Class Averages" (right)
        │   └── [Table row]                    ← Ant Design Table, 5 columns, pagination={false}, size="small"
        └── [AssessTaskModal]                  ← pre-existing modal; open/close owned by ClassPage composition root
```

The class detail view is the **only** supported entry point. There is no direct URL or nav-key-based entry. The `AppNavigationKey` enum stays at the four top-level keys (`dashboard | classes | assignments | settings`) and is not extended for v1.

## No extra navigation layers

The Class page does **not** use nested tabs, nested routes, accordions-as-navigation, or any secondary structure that would weaken clarity.

Rationale:

- The page surface is simple enough for a single scrollable view: the recent-assignment cards at the top and the student-averages table below. Two sections are the right depth for v1.
- The "Viewing: Overall Class Averages" affordance is a static label, not a `Select` or tab. Alternative views are v1.1+ scope.
- Drill-down to per-assignment or per-student detail views is v1.1+ scope. Keeping the v1 surface flat avoids speculative navigation infrastructure.

## Outer layout

The outer layout is a single-column vertical stack inside the `PageSection` wrapper inherited from `ClassesPage`. The page uses the existing `--app-page-width-wide-data` CSS custom property for the outer frame width (1280px), consistent with `ClassesPage` and other full-width data pages.

**Width ownership:**

- **Outer page width:** the existing `--app-page-width-wide-data` token (1280px, `width: min(var(--app-page-width-wide-data), calc(100% - 1rem))`), inherited from the `PageSection` wrapper on `ClassesPage`. No change to the shell width tokens.
- **Panel widths inside:** the `RecentAssignmentsSection` fills the page width; each card is 320px (`RECENT_ASSIGNMENT_CARD_WIDTH_PX`, a feature-local constant). The `StudentAveragesTableCard` fills the page width; the table expands to fill its container.
- The 320px card width is a feature-local constant because there is only one v1 consumer. It is not promoted to a shared width token per `frontend-loading-and-width-standards.md` §7.

**View‑entry loading policy:** The `getABClass` query is view‑entry‑only (not warm‑up‑backed per `frontend-react-query-and-prefetch.md` §2). The loading skeleton is shown while the query has no cached data and is fetching (React Query's `isPending` signal, typically true on first‑time mount). For the full React Query policy see `docs/developer/frontend/frontend-react-query-and-prefetch.md`; the layout surface follows the same loading‑state vocabulary as the rest of the app.

### Recommended page skeleton

```text
ClassesPage (thin shell)
└── <PageSection heading={pageContent.classes.heading} summary={pageContent.classes.summary}>   ← provides Space direction="vertical" size="middle"
    └── (when selectedClassId !== null)
        └── ClassPage (composition root)             ← children inside PageSection's Space
            │
            ├── <Breadcrumb items={[                 ← three-segment, in-page breadcrumb
            │     { title: 'AssessmentBot Frontend' },
            │     { title: 'Classes', onClick: handleBack }, ← clickable, clears selectedClassId
            │     { title: className },              ← non-clickable
            │   ]} />
            │
            ├── <Flex justify="space-between" align="center">
            │   ├── <Space direction="vertical" size={0}>
            │   │   ├── <Title level={2}>{className}</Title>
            │   │   └── <Typography.Text>{pageContent.classDetail.summary}</Typography.Text>
            │   └── <ClassPageHeaderActions />        ← Flex row of two buttons
            │
            ├── <RecentAssignmentsSection />          ← Card (small) with title="Recent Assignments" + Flex card row or Empty inside
            │   └── <Flex justify="center" gap="medium">
            │       └── <RecentAssignmentCard />×N (1-3)
            │
            └── <StudentAveragesTableCard />          ← Card (small) + Flex control row + Table
                ├── <Flex justify="space-between" align="center">
                │   ├── <Input.Search placeholder="Search by name" />
                │   └── <Typography.Text type="secondary">Viewing: Overall Class Averages</Typography.Text>
                └── <Table
                      dataSource={model.studentAverages}
                      columns={columns}
                      rowKey="studentId"
                      pagination={false}
                      size="small"
                      onChange={handleTableChange}
                      locale={{ emptyText: <Empty description="No students match your search" /> }}
                    />

{isAssessModalOpen && <AssessTaskModal ... />}       ← rendered at ClassesPage level inside PageSection's children
```

## Recommended top-level UI components

### 1. `Space` (vertical, `size="middle"`) — provided by `PageSection`

`PageSection` already wraps its children in `<Space direction="vertical" size="middle">`. The Class page content renders as children of `ClassesPage`'s `PageSection`, so the vertical stacking container is inherited from `PageSection`. The Class page should **not** add a redundant outer `Space`; its content blocks (breadcrumb, heading row, recent assignments, student averages table) are direct children of `PageSection`'s `Space`.

Reason:

- Avoids nested `Space` containers creating double `size="middle"` vertical gaps.
- Matches the existing `ClassesPage` pattern where `PageSection` wraps all children in a single `Space`.
- The `size="middle"` spacing (16px gap between children) provides consistent vertical rhythm across the three content blocks.

### 2. `Flex` (horizontal, inline)

Use `Flex` (not `Space`) for left-right arrangements that need `justify` alignment:

- The heading row: `justify="space-between"` with the page title on the left and the `ClassPageHeaderActions` on the right.
- The Recent Assignments card row: `justify="center"` with `gap="medium"` so the cards are centre-aligned regardless of count (1, 2, or 3).
- The `RecentAssignmentCard` metric cells: `Flex` inside each card for the four labels and `MetricPill` instances.
- The Student Averages control row: `justify="space-between"` with the `Input.Search` on the left and the static `Typography.Text` label on the right.

Reason:

- `Flex` does not add wrapper elements around children — important for the card row where we want direct flex-children cards.
- `Flex` supports `justify` and `align` with standard flexbox semantics.
- Matches Ant Design v6 recommendations for block-level element layouts, as distinct from `Space` which is designed for inline elements.

### 3. `Result` (status `warning` / `error`)

Use `Result` for full-page blocking errors, one per error type from the error‑precedence table in `SPEC_CLASS_PAGE.md`. The six error types (`classNotFound`, `classQueryError`, `analyserError`, `adapterError`, `assignmentDefinitionPartialsFailed`, `assignmentDefinitionPartialsUntrustworthy`) map to two `Result` status variants — `warning` for retryable errors and `error` for non‑retryable errors.

Reason:

- The spec explicitly deviates from the default `Alert` pattern (see `SPEC_CLASS_PAGE.md` §"Error, loading, and empty-state rules") because a full-page blocking state is a different primitive than a subregion blocking alert.
- `Result` provides a visually prominent, centred card with `title`, optional `subTitle`, and `extra` action buttons — matching the severity of a page-level blocking error.
- The `Result` component supports both `warning` and `error` status variants, mapping to retryable vs. non-retryable errors.

### 4. `Skeleton` (shell‑style paragraph pattern)

Use `Skeleton` for the initial loading state. The skeleton uses a simple paragraph‑row pattern (consistent with `ClassesPage` and other existing pages) rather than custom card‑shaped or table‑shaped skeletons:

- **Heading region:** `<Skeleton active title={{ width: '60%' }} paragraph={{ rows: 1, width: '40%' }} />`
- **Recent Assignments region:** `<Skeleton active paragraph={{ rows: 4 }} title={{ width: '40%' }} />`
- **Student Averages region:** `<Skeleton active paragraph={{ rows: 5 }} title={{ width: '40%' }} />`

Reason:

- The Ant Design `Skeleton` API's `title` / `paragraph` props provide adequate shape mimicry for this page without requiring custom `Skeleton.Node` layouts. The three skeletons fill the same vertical rhythm as the ready‑state content (heading row, card row, table row) without overspecifying pixel‑perfect placeholder shapes.
- The existing `ClassesPage` (`src/frontend/src/pages/ClassesPage.tsx:219–221`) and `AssignmentsPage` already use this same pattern (`<Skeleton active paragraph={{ rows: 4 }} title={{ width: '40%' }} />`). Consistency with the app's existing loading‑state vocabulary is preferred over speculative precision.
- **Deliberate deviation from canonical standard:** The `frontend-loading-and-width-standards.md` §3 standard calls for "a shape-matched skeleton in the exact region where the content will appear." The paragraph‑row pattern is a deliberate v1 deviation from that stricter standard, accepted for consistency with existing page loading vocabulary. A closer card‑ and table‑shaped skeleton match may be revisited in v1.1+.
- The `Skeleton` is wrapped in `role="status"` and `aria-live="polite"` per accessibility requirements.

## Region-by-region design

### 1. Page Breadcrumb

**Components:**

- `Breadcrumb`
- `Breadcrumb.Item` (via the `items` prop array)

**Content:**

- Three segments: `AssessmentBot Frontend`, `Classes`, `{className}`.
- The `Classes` segment is clickable — clicking it clears `selectedClassId` and returns to the class list.
- The `{className}` segment is non-clickable (current location).

**Implementation notes:**

- The three-segment breadcrumb is rendered by the class detail view itself in the page content area. It appears below the shell's existing two-segment breadcrumb (`AssessmentBot Frontend / Classes`). This temporary visual duplication — two breadcrumbs stacked in the same `Content` area — is an accepted v1 trade-off per `SPEC_CLASS_PAGE.md` decision 8. The visible artefact is: the shell renders `AssessmentBot Frontend / Classes` (via `AppShell.tsx`, sitting outside the `PageSection` wrapper), and immediately below it the class detail view renders `AssessmentBot Frontend / Classes / {className}` as the first child inside `PageSection`'s `Space`. No other current page in the app shows stacked breadcrumbs. A v1.1+ iteration may add a breadcrumb‑override prop on `AppShell` to hide the shell breadcrumb when a child page owns its own.
- The `AppShell` and `appNavigation.tsx` are **not** modified. The breadcrumb is part of the feature-local `ClassPage.tsx` content, not the shell.
- Uses the `items` prop with `RouteItemType` entries. The `Classes` entry includes an `onClick` handler; the `{className}` entry has no `onClick`.

**States:**

1. **All states** — the breadcrumb is always visible (it is part of the page content, not conditionally rendered). The shell's breadcrumb also remains visible above it.

**Notes:**

- The `Breadcrumb` component in Ant Design v6 accepts an `items` array of `{ title, href?, onClick? }` items. The `onClick` handler on the `Classes` item is the navigation handler that calls `onNavigateToClasses()`.
- The breadcrumb uses the default `/` separator.

### 2. Page Heading and Header Actions

**Components:**

- `Typography.Title` (level 2) — the dynamic `className` (e.g. `7A1 Digital Technology 2025-2026`)
- `Typography.Text` — the static summary sentence from `pageContent.classDetail.summary`
- `Flex` — horizontal layout, `justify="space-between"`, `align="center"`
- `ClassPageHeaderActions` — child component containing two buttons in a `Space`

**Content:**

- **Left side:**
  - `Title level={2}`: the class name (dynamic).
  - `Text` below the title: the `pageContent.classDetail.summary` sentence.
- **Right side (ClassPageHeaderActions):**
  - `Edit Student Details` button: `type="default"`, `disabled`, `icon={<EditOutlined />}`, wrapped in a `span` inside a `Tooltip title="Coming soon"` — because Ant Design v6 `Tooltip` does not trigger on `disabled` buttons directly.
  - `Start New Assessment` button: `type="primary"`, `icon={<PlusOutlined />}`, enabled, invokes `onStartNewAssessment`.

**States:**

1. **Loading** — heading row is a `Skeleton` block: `<Skeleton active title={{ width: '60%' }} paragraph={{ rows: 1, width: '40%' }} />`.
2. **Blocking** — heading row is not rendered; the `Result` component replaces the entire page content.
3. **Ready** — full heading row as described above.

**Notes:**

- The `ClassPageHeaderActions` does not own the `AssessTaskModal` open/close state; it is a presentational component that calls a prop callback.
- The `Edit Student Details` button is intentionally disabled in v1; the `Tooltip` wrapper on a `span` is the established pattern (matches `AssessTaskModal`'s "Link to Existing Definition" disabled button pattern).
- The `onStartNewAssessment` callback is passed to both `ClassPageHeaderActions` and `RecentAssignmentsSection` (empty-state CTA) so the action is discoverable from either entry point. The modal open/close state is a single source of truth in the page composition root.

### 3. Recent Assignments Section

**Components:**

- `Card` — Ant Design `Card`, `size="small"`, `title="Recent Assignments"`, full-width (wraps the section body)
- `Flex` — horizontal card row, `justify="center"`, `wrap="wrap"`, `gap="medium"`
- `RecentAssignmentCard` × 1–3 (max 3 cards, centre-aligned)
- `Empty` — when zero assignments exist; `description="No recent assessments yet"` with a `Button type="primary" icon={<PlusOutlined />}` as children, rendered inside the card body

**Content:**

- Card title: `Recent Assignments` (always rendered via the `Card` `title` prop, even in the empty state).
- Card row: up to three `RecentAssignmentCard` components, each 320px wide, centre-aligned in the row, rendered inside the card body.
- When fewer than three assignments exist: render only the available cards (1 or 2), still centre-aligned.
- When zero assignments: render `Empty` inside the card body in place of the card row. The `Empty` component receives `description="No recent assessments yet"` and a `Button type="primary" icon={<PlusOutlined />}` child that calls `onStartNewAssessment`. The button is placed inside `Empty`'s children slot (`<Empty description="..."><Button>...</Button></Empty>`) — the children slot is the simplest v1 pattern; Ant Design v6 also supports `Empty.footer` as an alternative semantic slot, but `children` is chosen here for its direct inline simplicity.
- **Empty‑state copy centralisation:** The strings `"No recent assessments yet"` and `"No students match your search"` are user‑facing copy. They must be extracted to `pageContent` during implementation, using the exact key paths:
  - `pageContent.classDetail.recentAssignmentsEmpty` → `"No recent assessments yet"`
  - `pageContent.classDetail.searchEmpty` → `"No students match your search"`
    These keys live in the `classDetail` namespace alongside the existing `pageContent.classDetail.heading` and `pageContent.classDetail.summary` entries. This is consistent with the page‑copy reuse policy at `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.6.

**States:**

1. **Loading** — the card body is replaced by `<Skeleton active paragraph={{ rows: 4 }} title={{ width: '40%' }} />`. The card's `title` (`Recent Assignments`) remains visible above the skeleton (consistent with the ready‑state placement via the `Card` `title` prop).
2. **Ready with 1–3 assignments** — cards rendered inside the card body.
3. **Ready with 0 assignments** — `Empty` component with CTA button, rendered inside the card body.
4. **Blocking** — the section is not rendered; the `Result` component replaces the entire page.

**Notes:**

- The section does not own the `onStartNewAssessment` callback — it receives it as a prop from the page composition root.
- The empty state is a positive nudge for new classes (not an error). The card `title` still renders above the `Empty` so the section structure is clear.
- The Card wrapper establishes visual parity with `StudentAveragesTableCard`, following the existing codebase pattern of wrapping content sections in `Card` (e.g., `AssignmentsPage`, `ClassesPage`, `ClassesToolbar`).
- The card width (`320px`) is wider than the existing `ClassesPage` class cards (`268px`) because the card must fit four `MetricPill` cells (Completeness, Accuracy, SpAG, Average) side-by-side without wrapping.

#### 3a. RecentAssignmentCard

**Components:**

- `Card` — Ant Design `Card`, `size="small"`, `style={{ width: RECENT_ASSIGNMENT_CARD_WIDTH_PX }}` (= 320)
- `Typography.Text` — `type="secondary"` for the "Last Assessed: {date}" line
- `Flex` — horizontal row of four metric cells, `justify="space-around"` or `gap="small"`
- `MetricPill` — the shared display helper (defined in the prep spec), used for each of the four metrics

**Content:**

- **Title region:** the assignment name (passed as the `Card` `title` prop).
- **Body:**
  - "Last Assessed: {date}" — `Typography.Text type="secondary"`. The date is pre-formatted by the adapter.
  - Four metric cells in a horizontal `Flex` row, left-aligned:
    1. **Completeness** — vertical `Flex`: label on top, `MetricPill` on bottom.
    2. **Accuracy** — vertical `Flex`: label on top, `MetricPill` on bottom.
    3. **SpAG** — vertical `Flex`: label on top, `MetricPill` on bottom.
    4. **Average** — vertical `Flex`: label on top, `MetricPill emphasised={true}` on bottom. This cell is centre-aligned (vertically and horizontally emphasised) to match the mockup.
- The `Average` cell is visually distinguished via `MetricPill`'s `emphasised` prop, which applies `fontSize: '17.5px'` and `fontWeight: 600`.

**States:**

1. **Ready** — card with title, last-assessed line, and four metric pills.
2. **The card is static** — no hover, no click handler, no `hoverable` prop in v1. The card does not expand or flip.

**Notes:**

- The card uses `size="small"` for 12px body padding, consistent with the existing class cards on `ClassesPage`.
- The `RECENT_ASSIGNMENT_CARD_WIDTH_PX` constant (320) is defined in `RecentAssignmentCard.tsx` with a comment explaining the justification.
- Per `frontend-loading-and-width-standards.md` §7, feature‑local width constants should be promoted to a shared, intent‑named token (e.g. `--app-card-width-class-recent`) when a second consumer emerges. The single‑caller status today makes extraction premature; promotion is deferred until that second consumer is in accepted scope.
- The "Last Assessed" line never renders a `—` fallback. A null `updatedAt` is a data bug that the adapter surfaces as a blocking state.
- The per-card empty/MetricPill states (computed, notAttempted, error) are handled by `MetricPill` itself via the `MetricResult` discriminated union.

### 4. Student Averages Table Card

**Components:**

- `Card` — Ant Design `Card`, `size="small"`, `title="Student Averages"`, full-width
- `Flex` — control row inside the card: `justify="space-between"`, `align="center"`
- `Input.Search` — `placeholder="Search by name"`, updates `searchTerm` on change (no debounce in v1)
- `Typography.Text` — `type="secondary"`, static label: `Viewing: Overall Class Averages`
- `Table` — Ant Design `Table`, `pagination={false}`, `size="small"`
- `Empty` — table `locale.emptyText` slot: `No students match your search`

**Content:**

- **Card body** (two regions):
  - **Control row:** `Input.Search placeholder="Search by name"` on the left; `Typography.Text type="secondary"` with `Viewing: Overall Class Averages` on the right.
  - **Table:** five columns:
    1. `Student Name` — plain `Typography.Text` rendering; `sorter` locale-aware, case-insensitive, `studentId` tie-breaker. No column-level filters.
    2. `Completeness` — `MetricPill` rendering; column-level band filters (`red`, `gold`, `green`, `default`, `volcano`); `sorter` state-aware.
    3. `Accuracy` — `MetricPill` rendering; column-level band filters; `sorter` state-aware.
    4. `SpAG` — `MetricPill` rendering; column-level band filters; `sorter` state-aware.
    5. `Average` — `MetricPill emphasised={true}` rendering; column-level band filters; `sorter` state-aware.

**States:**

1. **Loading** — the entire `Card` is replaced by `<Skeleton active paragraph={{ rows: 5 }} title={{ width: '40%' }} />`.
2. **Ready with students** — control row + table with data.
3. **Ready with no students matching search** — control row + table with `Empty` in the table body (via `locale.emptyText`). The `Empty` says `No students match your search`. The header actions and `Start New Assessment` button remain available at the top of the page.
4. **Blocking** — the card is not rendered; the `Result` component replaces the entire page.

**Notes:**

- No pagination: class sizes are expected to be < 30 students. Pagination would add unnecessary UI complexity.
- No search debounce: the model is pure and synchronous over an in-memory list, so filtering on every keystroke is negligible (the model‑layer rationale lives in `SPEC_CLASS_PAGE.md` §462; the layout surface has no debounce).
- No `Select` for the "Viewing:" affordance in v1 — it is a static label. A real `Select` is v1.1+ scope.
- The `Input.Search` does not have a submit button (`enterButton` is not used) and no `onSearch` callback is wired because filters apply on keystroke. The search icon is therefore purely decorative in this configuration — it visually identifies the field as a search input but does not trigger a distinct action on click or Enter.
- The `Table.onChange` event provides `(pagination, filters, sorter, extra)`. The `sorter` is a `SorterResult<RecordType>` object with `order: 'ascend' | 'descend' | null`. The component maps Ant Design's `'ascend'` / `'descend'` to the model's `'asc'` / `'desc'` vocabulary and resets to the default sort (studentName ascending) when `sorter.order` is `null` (the third click clears the sort).
- Column-level band filters use the `MetricToneColor` token set (`'red' | 'gold' | 'green' | 'default' | 'volcano'`), the same tokens used by `resolveMetricTone` for rendering, so filter colours and pill colours cannot diverge.

#### 4a. Column Filter Details

**Filter items per metric column** (in order):

1. `{ text: 'Red (low)', value: 'red' }`
2. `{ text: 'Amber (mid)', value: 'gold' }`
3. `{ text: 'Green (high)', value: 'green' }`
4. `{ text: 'Not Attempted', value: 'default' }`
5. `{ text: 'Error', value: 'volcano' }`

**`onFilter` behaviour:**

- `(value: string, record: StudentAverageRowModel) => boolean`
- Computes the cell's band via `resolveMetricTone(record.metrics[columnKey], { lower: 0, upper: 5 }).color` and compares the result to `value` (strict equality).
- The range `{ lower: 0, upper: 5 }` is the `metricTone` default range, matching the range used for rendering.

**Sort behaviour (state-aware):**

- `asc`: rank order — `computed` (sorted by numeric value ascending) → `notAttempted` → `error` (always last).
- `desc`: rank order — `error` (always first) → `notAttempted` → `computed` (sorted by numeric value descending).
- Tie-breaker for same state and same numeric value (or same name): `studentId` ascending.

## Workflow surfaces

### 1. AssessTaskModal

**Surface type:**

- `Modal` — pre-existing feature-scoped modal at `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`

**Trigger:**

- Two entry points, both invoke the same `onStartNewAssessment` callback owned by the page composition root:
  1. The `Start New Assessment` button in `ClassPageHeaderActions`.
  2. The `Start New Assessment` button in the `Empty` state of `RecentAssignmentsSection`.

**Components:**

- `AssessTaskModal` — reused as-is. Reads `classId`, `className`, `onClose`. No signature change required.

**States:**

1. **Closed** — the modal is not rendered. Both trigger buttons are visible and enabled (subject to reference-data trustworthiness checks on the trigger side).
2. **Open and ready** — the modal renders with the current `classId` and `className`. The user completes the assessment workflow.
3. **Submitting** — the modal's primary action shows `confirmLoading`. Conflicting controls within the modal are disabled.
4. **Validation failure** — error is displayed inside the modal (per `Docs/developer/frontend/frontend-modal-patterns.md` §"Modal Error Handling Pattern"). The modal stays open.
5. **Completed** — the modal closes (`onClose` is called). v1 does not include a refresh/invalidation after completion (v1.1+ non-goal).

**Notes:**

- The page composition root owns `isAssessModalOpen` as a single `boolean` state.
- The `AssessTaskModal` is rendered at the page root level (not inside `ClassPageReady`), because the modal open/close state persists across the loading / blocking / ready state transitions.
- The modal follows the existing `AssessTaskModal` behaviour; no new layout decisions are needed for this surface.
- No `Edit Student Details` modal in v1 (the button is disabled with a `Coming soon` tooltip).

## Global state rules

### Blocking error state

- **What is shown:** An Ant Design `Result` component centred in the page, replacing all content. The `Result` shows:
  - A `status` variant (`warning` for retryable errors, `error` for non-retryable errors).
  - A `title` string specific to the error type (per the error-precedence table in `SPEC_CLASS_PAGE.md` §"Blocking failure").
  - A `extra` slot containing action buttons:
    - For **retryable** errors (`classQueryError`, `analyserError`, `assignmentDefinitionPartialsFailed`, `assignmentDefinitionPartialsUntrustworthy`): two buttons — `Retry` (`type="primary"`, invokes the hook's `refetch`) is the primary action; `Back to Classes` (`type="default"`, invokes `onNavigateToClasses`) is the secondary action.
    - For **non-retryable** errors (`classNotFound`, `adapterError`): one button — `Back to Classes` (`type="primary"`, invokes `onNavigateToClasses`) is the only action.
- **What is not shown as interactive:** The page content, the breadcrumb, header actions, cards, and table are all replaced by the `Result`. The shell's breadcrumb remains visible above the feature area (it is part of `AppShell`, not the class detail view).

### Partial-load state

- The Class page does not have a partial-load state in v1. The `getABClass` query and the `assignmentDefinitionPartials` warm-up dataset are the only data inputs. If either fails, the page enters the blocking error state. A partial-load warning is not a v1 use case.

### Empty state

- **Recent Assignments — no assignments:** `Empty description="No recent assessments yet"` with a `Button type="primary" icon={<PlusOutlined />}` children slot, rendered inside the section `Card` body. The `Card` `title` (`Recent Assignments`) remains visible above the `Empty`.
- **Student Averages table — no students match search:** `Empty description="No students match your search"` shown via the Table's `locale.emptyText` prop. No CTA (the page already has `Start New Assessment` in the header).
- **Actions that remain available in empty states:** `Start New Assessment` is available from both the header and the empty-state CTA. The `Edit Student Details` button remains disabled. The student-name `Input.Search` remains interactive but shows the empty table.

### Success and mutation feedback

- `Start New Assessment` opens the `AssessTaskModal`; the modal handles its own success / error feedback. The Class page does not render a separate `message` or `notification` for the assessment workflow.
- A refresh control or invalidation after `Start New Assessment` completes is a v1.1+ non-goal. The user must navigate away and back in v1 to see new assessment results.

## Responsive behaviour

- **Narrow viewports (< 768px):** The Recent Assignment card row wraps via `Flex wrap="wrap"`. Cards stack vertically when the viewport cannot fit three 320px cards side by side. Each card remains 320px wide.
- **Table scrolling:** The Student Averages `Table` should use `scroll={{ x: 'max-content' }}` to allow horizontal scrolling on narrow viewports. The `Table` has 5 columns and is expected to need horizontal scroll below ~600px viewport width.
- **Card width:** Cards are fixed at 320px and do not stretch to fill the container. The `Flex` row centres them with `justify="center"`, so when wrapping occurs, cards are centred in each row.
- **Minimum action visibility:** The two header action buttons (`Edit Student Details` and `Start New Assessment`) should remain visible and not wrap below their combined width. If the viewport is very narrow (< 400px), the heading row could stack vertically (heading above, actions below), but this is an edge case for v1 and not explicitly handled — the `Flex` row's default `wrap="nowrap"` combined with `gap="small"` will keep the buttons visible.
- **Breadcrumb:** The three-segment breadcrumb may wrap on narrow viewports. Ant Design `Breadcrumb` handles wrapping naturally.

## Accessibility and motion

- **Focus management:**
  - When the class page opens, focus stays on the trigger (the `View` button on the class card in `ClassesPage`). No custom focus management is added — this is the standard browser behaviour.
  - When the `AssessTaskModal` opens, focus moves to the modal. When the modal closes, focus returns to the trigger that opened it (standard Ant Design `Modal` behaviour).
  - When the user clicks the breadcrumb `Classes` link, `selectedClassId` is cleared and the class list renders. Focus returns to the top of the page content.
- **Loading state announcement:** The shape-matched `Skeleton` is rendered with `role="status"` and `aria-live="polite"`. The page composition root owns the accessible wrapper; `ClassPageLoading` renders the primitives.
- **Blocking error announcement:** The `Result` component includes its own accessible labelling via the `title` text. No additional `aria-live` region is needed.
- **Tooltip-only information:** The disabled `Edit Student Details` button has a `Tooltip` with `Coming soon` text. The `Tooltip` text is provided as a hover affordance only; the button's visual disabled state and `aria-disabled` attribute (set by Ant Design automatically on `disabled` buttons) provide the accessible cue.
- **Pill accessibility gap (v1.1+):** The `MetricPill` tag uses colour + single-character labels (`N`, `E`, numeric value). In v1, there is no `Tooltip` or `aria-label` on the pill. A screen reader announces the text label (`2.18`, `N`, `E`) but without the colour context cannot distinguish `notAttempted` from `error` or from a low `computed` value. This is a deliberate v1 trade-off documented in `SPEC_CLASS_PAGE.md` with product sign-off.
- **Reduced motion:** The page does not use custom CSS animations or transitions beyond Ant Design defaults. The `Skeleton` uses Ant Design's built-in active animation, which honours the OS reduced-motion preference via the global `AppThemeShell` token (motion is disabled when `prefers-reduced-motion: reduce` is active). No additional reduced-motion handling is needed.
- **Keyboard interaction:**
  - The `Table` supports native keyboard navigation for row selection (if any) and sorting (via column header click). No custom keyboard handling.
  - The `Input.Search` is a standard form input with keyboard support.
  - The `Breadcrumb` items are rendered as `<span>` elements with `onClick`; they are not focusable by default. The `Classes` clickable segment could be made focusable (via `role="button"` and `tabIndex={0}`) in v1.1+ if needed; in v1, it follows the existing shell breadcrumb pattern (clickable but not tab-focusable).

## Implementation guardrails

- Do not introduce alternative entry points for the Class page beyond the `View` button on class cards. No URL-based routing, no direct deep linking, no nav-key-based entry (v1.1+ scope).
- Do not duplicate domain rules here that belong in `SPEC_CLASS_PAGE.md` — this document focuses on layout hierarchy, component choices, and visible behaviour.
- Do not add bespoke layout abstractions when existing Ant Design primitives (`Flex`, `Space`, `Card`, `Table`, `Breadcrumb`, `Result`, `Empty`, `Skeleton`) are sufficient.
- Do not hide blocking error outcomes inside transient UI surfaces (e.g. a toast that auto‑dismisses). Use full-page `Result` for blocking errors.
- Keep layout decisions aligned with existing frontend shell and navigation guidance — the shell's `AppNavigationKey` and `getBreadcrumbItems` are not modified in v1. The class detail view renders its own three-segment breadcrumb in the page content area.
- Do not create a `index.ts` barrel in `features/classPage/` in v1. Direct imports are clearer for two related symbols.
- Do not promote the `RECENT_ASSIGNMENT_CARD_WIDTH_PX` constant to a shared width token unless a second consumer emerges.
- Do not modify `AppShell.tsx` or `appNavigation.tsx` for v1 breadcrumb wiring. The shell's two-segment breadcrumb remains, and the class page's three-segment breadcrumb is rendered in the page content area.

## Open questions

None for v1. All layout decisions for the Class page are captured above and in `SPEC_CLASS_PAGE.md`. The following v1 layout decisions are reaffirmed:

- The page uses `Result` (not `Alert`) for blocking states — a documented deviation from the default pattern.
- The breadcrumb is rendered in-page by `ClassPage.tsx` (not by the shell), accepting temporary visual duplication with the shell's two-segment breadcrumb.
- The "Viewing:" affordance is a static `Typography.Text` label (not a `Select`) in v1.
- The `Edit Student Details` button is disabled with a `Tooltip` wrapper in v1.
- No search debounce in v1 (class sizes < 30 students).
- No pagination on the Student Averages table (class sizes < 30 students).
