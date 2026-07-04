# Class Page React Query Analysis

Based on my analysis of the codebase, here's how the class page fetches and manages class data:

## 1. React Query Usage

**File: `src/frontend/src/features/classPage/useClassPageData.ts`**

The class page uses React Query to fetch per-class data through:

- `useQuery` hook from `@tanstack/react-query`
- `getABClassQueryOptions(classId)` from `src/frontend/src/query/sharedQueries.ts`

**Data Flow:**

```typescript
const classFullQuery: UseQueryResult<ClassFull | null, Error> = useQuery(
  getABClassQueryOptions(classId)
);
```

**Additional Query Dependencies:**

- `usePageDataset<AssignmentDefinitionPartialsResponse>('assignmentDefinitionPartials')` for warm-up data
- Both queries are orchestrated in a single `useClassPageData` hook to produce combined view-model results

## 2. Query Key

**File: `src/frontend/src/query/queryKeys.ts`**

The query uses a simple static key structure:

```typescript
abClass: (classId: string) => ['abClass', classId] as const;
```

This creates a query key like `['abClass', 'your-class-id']` that uniquely identifies the per-class data for caching and invalidation.

**Usage in sharedQueries.ts:**

```typescript
export function getABClassQueryOptions(classId: string) {
  return queryOptions({
    queryKey: queryKeys.abClass(classId),
    queryFn: () => getABClass({ classId }),
  });
}
```

## 3. Retry Configuration

**File: `src/frontend/src/query/sharedQueries.ts`**

The `getABClassQueryOptions` does **not** explicitly configure retry behavior, which means it **uses React Query's default retry settings**:

**Default React Query Retry Behavior:**

- Retry on failed queries with exponential backoff
- Default retries: 3 attempts
- Default retry delay: 1000ms (with exponential backoff multiplier)

**Test Environment Override:**
**File: `src/frontend/src/features/classPage/useClassPageData.spec.ts`**

```typescript
define(new QueryClient({
  defaultOptions: {
    queries: { retry: false }, // Disabled for tests to prevent infinite loops
  },
}));
```

**Key Insight:** Since no explicit retry configuration is found in production code, the query relies on React Query's standard retry behavior, which provides built-in resilience against temporary network failures.

## 4. Retry Button Implementation and Refetch Trigger

### Retry Button Component

**File: `src/frontend/src/features/classPage/ClassPageContent.tsx`**

The retry button is rendered conditionally for retryable errors:

```typescript
// Line 192-199: RetryButton rendering for classQueryError
{config.retryable && (
  <Button type="primary" onClick={onRetry}>
    Retry
  </Button>
)}
```

### Error Configuration Map

The system determines if an error is retryable through `ERROR_CONFIG_MAP`:

```typescript
const ERROR_CONFIG_MAP: Record<ClassPageError['type'], ErrorConfig> = {
  classNotFound: { status: 'error', title: 'Class not found', retryable: false },
  classQueryError: { status: 'warning', title: "Couldn't load class", retryable: true }, // ← RETRYABLE
  analyserError: { status: 'warning', title: "Couldn't compute averages", retryable: true }, // ← RETRYABLE
  adapterError: { status: 'error', title: 'Class data is invalid', retryable: false },
  assignmentDefinitionPartialsFailed: {
    status: 'warning',
    title: "Couldn't load assessment definitions",
    retryable: true, // ← RETRYABLE
  },
  assignmentDefinitionPartialsUntrustworthy: {
    status: 'warning',
    title: 'Assessment definitions are unavailable',
    retryable: true, // ← RETRYABLE
  },
};
```

### Retry Flow

1. **Error Detection:** When a retryable error occurs (e.g., `classQueryError`), the surface state becomes `blocking` with structured error
2. **Button Display:** `ClassPageContent` conditionally renders the retry button based on `config.retryable`
3. **Refetch Trigger:** Clicking the button calls the `onRetry` callback
4. **Implementation:** `ClassPage.tsx` passes the `refetch` function from `useClassPageData`
5. **UseClassPageData Handle:** The `refetch` callback in `useClassPageData.ts` delegates to the React Query's internal `classFullQuery.refetch()` method

```typescript
// In ClassPage.tsx
<const { surfaceState, classFull, adapterResult, error, refetch } =
  useClassPageData(classId);

// Passed to ClassPageContent
<ClassPageContent ... onRetry={refetch} />

// In useClassPageData.ts
const { refetch: queryRefetch } = classFullQuery;
const refetch: () => void = useCallback((): void => {
  queryRefetch();
}, [queryRefetch]);
```

### Key Design Pattern

**Stale-Proof Refetch:** The implementation uses a deliberate dependency pattern to prevent stale data refetches:

1. The `refetch` callback destructures `classFullQuery.refetch` to capture its stable identity
2. This prevents the retry button from accidentally refetching classes the user has navigated away from
3. Each query instance gets its own stable `refetch` function

```typescript
/**
 * Avoids stale-closure bugs by depending on `queryRefetch`
 * rather than capturing `classId` directly
 */
const refetch: () => void = useCallback((): void => {
  queryRefetch();
}, [queryRefetch]);
```

## Summary

- **Query Fetching:** Uses `useQuery` with `getABClassQueryOptions` to fetch per-class data
- **Query Key:** Uses `['abClass', classId]` pattern for unique identification
- **Retry:** Default React Query retry behavior (3 attempts with exponential backoff)
- **Retry Button:** Only shown for retryable errors (`classQueryError`, `analyserError`, etc.)
- **Refetch:** Triggers via React Query's built-in `refetch()` with stale-proof design

The system provides a robust data-fetching experience with intelligent retry behavior and clear user feedback when errors occur.
