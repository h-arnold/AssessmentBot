# Assessment Table Implementation Findings

Date: 2026-07-07

## Overview

Analysis of what's required to build an Ant Design table matching the provided
screenshot (two-row grouped header with per-task metrics) using existing codebase
infrastructure.

## Screenshot Requirements

The target table has:

- **Two-row header**: Task names span 3 columns each (Completeness, Accuracy, SPaG)
- **Sticky first column**: Student names remain visible when scrolling
- **Colour-coded cells**: Green/amber/red based on score bands
- **"N" values**: For unattempted tasks (grey/muted styling)
- **Dynamic columns**: Number of columns depends on number of tasks

## Ant Design Capabilities

| Feature                | Built-in Support           | Notes                           |
| ---------------------- | -------------------------- | ------------------------------- |
| Two-row grouped header | Yes (`children` property)  | First-class feature, not a hack |
| Sticky first column    | Yes (`fixed: 'start'`)     | Native support                  |
| Bordered cells         | Yes (`bordered` prop)      | Enables grid lines              |
| Custom cell rendering  | Yes (`render` function)    | For colour logic                |
| Column filters         | Yes (`filters`/`onFilter`) | Reusable pattern                |

**Conclusion:** Minimal extension required. The grouped header is fully
supported via the `children` property on column definitions.

## Existing Reusable Infrastructure

### 1. Colour Resolution

**File:** `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`

```typescript
resolveMetricTone(metric: MetricResult, range?: MetricToneRange): MetricToneResolution
```

- Pure function, no React/antd imports
- Maps `MetricResult` to colour band: `red` | `gold` | `green` | `default` | `volcano`
- Returns `displayValue` (`number` | `'N'` | `'E'`) and `muted` flag
- Default range: `{ lower: 0, upper: 5 }`
- Quartile-based band boundaries:
  - `red`: value < (3·lower + upper) / 4
  - `gold`: (3·lower + upper) / 4 ≤ value < (lower + 3·upper) / 4
  - `green`: value ≥ (lower + 3·upper) / 4

### 2. MetricPill Component

**File:** `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`

```tsx
<MetricPill metric={metricResult} emphasised={false} precision={2} />
```

- Renders Ant Design `Tag` with resolved colour
- Supports `emphasised` mode (larger font, bold)
- Muted styling for `notAttempted` state (opacity: 0.55)
- Pure presentational component, no state

### 3. Column Builder Pattern

**File:** `src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`

```typescript
buildMetricColumn(key, title, filters, emphasised?): TableColumnType
```

- Encapsulates: filter config, `onFilter` predicate, `MetricPill` rendering
- Filter items: `METRIC_COLUMN_FILTERS` (red/gold/green/default/volcano)
- Already integrated with `resolveMetricTone` for filter matching

### 4. Metric Accessor

**File:** `src/frontend/src/features/classPage/classPageAdapter.zod.ts`

```typescript
getStudentMetric(metrics, key: 'completeness' | 'accuracy' | 'spag' | 'average'): MetricResult
```

- Switch-based accessor (satisfies ESLint `security/detect-object-injection`)
- Single source of truth for metric access

## Data Model Difference

| Aspect    | Current `StudentAverageRowModel`            | Required for New Table                                 |
| --------- | ------------------------------------------- | ------------------------------------------------------ |
| Structure | One metric set per student                  | Per-assignment metrics per student                     |
| Metrics   | `{ completeness, accuracy, spag, average }` | `{ [assignmentId]: { completeness, accuracy, spag } }` |
| Scope     | Averages across all assignments             | Individual task scores                                 |

The current model (`classPageAdapter.zod.ts:95-106`) stores averaged metrics.
The new table requires a different shape with per-assignment breakdowns.

## Proposed Column Structure

```typescript
const columns = [
  {
    title: 'Name',
    dataIndex: 'studentName',
    fixed: 'start',
    rowSpan: 2,  // Spans both header rows
  },
  {
    title: 'The Guessing Game',
    children: [
      { title: 'Completeness', render: (_, record) => <MetricPill metric={...} /> },
      { title: 'Accuracy', render: (_, record) => <MetricPill metric={...} /> },
      { title: 'SPaG', render: (_, record) => <MetricPill metric={...} /> },
    ],
  },
  // ... repeat for each task
];
```

## Implementation Estimate

| Task                        | Effort    |
| --------------------------- | --------- |
| New data model (Zod schema) | 30 min    |
| Adapter transformation      | 1 hr      |
| New column builder function | 1 hr      |
| Testing                     | 30 min    |
| **Total**                   | **3 hrs** |

The hard parts (colour logic, pill rendering, filter patterns) are already
complete. Implementation is primarily wiring up the grouped header structure
and a new data adapter.

## References

- Ant Design Table docs: https://ant.design/components/table
- Grouping table head demo: `#table-demo-grouping-columns`
- `colSpan`/`rowSpan` demo: `#table-demo-colspan-rowspan`
- Existing class page: `src/frontend/src/features/classPage/`
