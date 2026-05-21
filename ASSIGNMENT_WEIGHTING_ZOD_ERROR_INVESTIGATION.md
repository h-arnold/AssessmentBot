# Assignment Weighting Upsert Zod Error Investigation

## Issue Description

The upsert operation fails when setting assignment weightings with the following frontend error:

```json
{
  "context": "services/apiService.callApi",
  "errorMessage": "[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"object\",\n    \"path\": [],\n    \"message\": \"Invalid input\"\n  }\n]",
  "level": "error"
}
```

## Root Cause Analysis

### Error Chain

1. `runWizardMutation` (actionType: "save") calls `upsertMutation.mutateAsync(options.request)`
2. → `upsertAssignmentDefinition(request)` in `assignmentDefinitionService.ts`
3. → `UpsertAssignmentDefinitionRequestSchema.parse(request)` — **Passes** (request has all required fields)
4. → `callApi(UPSERT_ASSIGNMENT_DEFINITION_METHOD, parsedRequest)`
5. → `ApiResponseSchema.parse(response)` — **Likely passes** (backend returns valid envelope)
6. → `UpsertAssignmentDefinitionResponseSchema.parse(parsedResponse.data)` — **FAILS**

### The Problem

`UpsertAssignmentDefinitionResponseSchema.parse()` receives `undefined` or a non-object value, causing:

```
ZodError: expected object at path []
```

**Root Cause:** `parsedResponse.data` is `undefined` because the backend response's `data` field is either:

- Missing entirely
- Explicitly `undefined`
- Contains values that fail schema validation

### Backend Response Verification

The backend **does** return a valid response (per logs):

```json
{
  "ok": true,
  "requestId": "d3b3e416-c09f-4cfb-a5cc-47312cfccc13",
  "data": {
    "definitionKey": "dc375e35-17fa-45f6-b8a0-40bc913fc99e",
    "primaryTitle": "IP Spoofing, MiTM & DNS Cache Poisoning",
    "primaryTopicKey": "ece440a5-2d87-46fe-977e-6c49657a4466",
    "primaryTopic": "Cyber Security",
    "yearGroupKey": "fed11651-5d54-4e95-9afe-aa9ede161c0f",
    "yearGroupLabel": "9",
    "alternateTitles": [],
    "alternateTopics": [],
    "documentType": "SLIDES",
    "referenceDocumentId": "11szVZ-dugaQwqM-LatbLN4ARAb7C_c57P_une5tYACo",
    "templateDocumentId": "1R8NGNwMwEc09ereC2NF_isOO-mXulgMTlMXHUhIE5F0",
    "assignmentWeighting": 1,
    "tasks": [...],
    "createdAt": "2026-05-21T13:19:01.026Z",
    "updatedAt": "2026-05-21T13:19:39.098Z"
  }
}
```

This response **matches** `AssignmentDefinitionSchema` (which is used for `UpsertAssignmentDefinitionResponseSchema`).

### Hypotheses

#### Hypothesis 1: `_success()` returns `undefined` for data (Most Likely)

In `z_apiHandler.js`, the `_success` method:

```javascript
_success(requestId, data) {
  return {
    ok: true,
    requestId,
    data,  // If `data` is undefined, response has "data": undefined
  };
}
```

If `controller.toCanonicalFullDefinitionResponse(definition)` returns `undefined` (or has undefined fields that cause validation to fail), the frontend's `ApiResponseSchema.parse(response)` would succeed, but `parsedResponse.data` would be `undefined`.

Then `UpsertAssignmentDefinitionResponseSchema.parse(undefined)` throws the ZodError.

**Verification needed:** Check if `toCanonicalFullDefinitionResponse` can return `undefined`.

#### Hypothesis 2: Schema Mismatch in Task Objects

The backend returns `tasks` as an array of objects with `taskId`, `taskTitle`, `taskWeighting`.

The frontend expects `z.array(AssignmentDefinitionTaskSchema)` where:

```typescript
const AssignmentDefinitionTaskSchema = z
  .object({
    taskId: TrimmedNonEmptyStringSchema,
    taskTitle: TrimmedNonEmptyStringSchema,
    taskWeighting: WeightingSchema,
  })
  .strict();
```

If any task has `undefined` for any of these fields, parsing fails.

**Verification needed:** Check if `_toCanonicalFullDefinitionResponse` filters tasks with missing fields.

#### Hypothesis 3: Required Fields Are Undefined

`_toCanonicalFullDefinitionResponse` returns:

```javascript
{
  definitionKey: source.definitionKey,
  primaryTitle: source.primaryTitle,
  primaryTopicKey: source.primaryTopicKey,
  primaryTopic: source.primaryTopic,
  // ... other fields
}
```

If `source` (from `definition.toJSON()`) has any required field as `undefined`, the frontend schema (which uses `.strict()` and does not accept `undefined` for required fields) will fail.

**Verification needed:** Check if `source` can have undefined required fields.

### Code Path Analysis

```
upsertAssignmentDefinition_(parameters)
  → validateUpsertParameters_(parameters)
  → controller.upsertDefinition(payload)
    → new AssignmentDefinition({...})
    → _persistDefinitionWithRollback({definition, ...})
      → returns AssignmentDefinition.fromJSON(fullPayload)
  → controller.toCanonicalFullDefinitionResponse(definition)
    → source = definition.toJSON()
    → returns { definitionKey: source.definitionKey, ... }
```

**Key Question:** Can `definition.toJSON()` or the raw definition have `undefined` for required fields?

### Schema Comparison

| Field               | Backend Response | Frontend Schema                       | Nullable? | Strict? |
| ------------------- | ---------------- | ------------------------------------- | --------- | ------- |
| definitionKey       | string           | TrimmedNonEmptyStringSchema           | ❌        | ✅      |
| primaryTitle        | string           | TrimmedNonEmptyStringSchema           | ❌        | ✅      |
| primaryTopicKey     | string           | TrimmedNonEmptyStringSchema           | ❌        | ✅      |
| primaryTopic        | string           | TrimmedNonEmptyStringSchema           | ❌        | ✅      |
| yearGroupKey        | string           | TrimmedNonEmptyStringSchema           | ❌        | ✅      |
| yearGroupLabel      | string           | TrimmedNonEmptyStringSchema           | ❌        | ✅      |
| alternateTitles     | []               | z.array(...)                          | ❌        | ✅      |
| alternateTopics     | []               | z.array(...)                          | ❌        | ✅      |
| documentType        | "SLIDES"         | DocumentTypeSchema                    | ❌        | ✅      |
| referenceDocumentId | string           | TrimmedNonEmptyStringSchema           | ❌        | ✅      |
| templateDocumentId  | string           | TrimmedNonEmptyStringSchema           | ❌        | ✅      |
| assignmentWeighting | 1                | WeightingSchema.nullable()            | ✅        | ✅      |
| tasks               | [...]            | z.array(...)                          | ❌        | ✅      |
| createdAt           | ISO string       | NullableIsoDateTimeWithTimezoneSchema | ✅        | ✅      |
| updatedAt           | ISO string       | NullableIsoDateTimeWithTimezoneSchema | ✅        | ✅      |

**Critical:** All required fields must be present and non-`undefined`. The `.strict()` modifier rejects extra fields AND `undefined` values for required fields.

### Recommended Fixes

#### Fix 1: Ensure `_success()` Never Returns Undefined Data (Priority: High)

In `src/backend/z_Api/z_apiHandler.js`:

```javascript
_success(requestId, data) {
  return {
    ok: true,
    requestId,
    data: data ?? null,  // Coerce undefined to null
  };
}
```

**Rationale:** `UpsertAssignmentDefinitionResponseSchema` accepts `null` for nullable fields but NOT `undefined`. This ensures the response envelope is always valid.

#### Fix 2: Coerce Undefined to Null in Canonical Response (Priority: High)

In `src/backend/y_controllers/AssignmentDefinitionController.js`, update `_toCanonicalFullDefinitionResponse` to handle undefined fields:

```javascript
return {
  definitionKey: source.definitionKey ?? null,
  primaryTitle: source.primaryTitle, // Required - do NOT coerce
  primaryTopicKey: source.primaryTopicKey, // Required - do NOT coerce
  primaryTopic: source.primaryTopic ?? null,
  yearGroupKey: canonicalYearGroupKey, // Resolved - always string
  yearGroupLabel: canonicalYearGroupLabel, // Resolved - always string
  alternateTitles: source.alternateTitles ?? [],
  alternateTopics: source.alternateTopics ?? [],
  documentType: source.documentType, // Required - do NOT coerce
  referenceDocumentId: source.referenceDocumentId, // Required
  templateDocumentId: source.templateDocumentId, // Required
  assignmentWeighting: source.assignmentWeighting ?? null, // Nullable per schema
  tasks: canonicalTasks, // Always array
  createdAt: source.createdAt ?? null, // Already handled
  updatedAt: source.updatedAt ?? null, // Already handled
};
```

**Important:** Only coerce fields that are `.nullable()` or `.optional()` in the schema. Required fields (non-nullable) should throw if undefined.

#### Fix 3: Add Validation in `_toCanonicalFullDefinitionResponse` (Priority: Medium)

Add a validation step to ensure all required fields are present:

```javascript
const requiredFields = [
  'definitionKey',
  'primaryTitle',
  'primaryTopicKey',
  'primaryTopic',
  'yearGroupKey',
  'yearGroupLabel',
  'documentType',
  'referenceDocumentId',
  'templateDocumentId',
  'tasks',
];
for (const field of requiredFields) {
  if (result[field] === undefined) {
    throw new Error(`Canonical response missing required field: ${field}`);
  }
}
```

This would catch missing fields early and provide a clear error message.

### Next Steps

1. **Verify Hypothesis 1:** Add logging in `_success()` to check if `data` is `undefined`

   ```javascript
   _success(requestId, data) {
     if (data === undefined) {
       ABLogger.getInstance().error('Success response with undefined data', { requestId });
     }
     return { ok: true, requestId, data: data ?? null };
   }
   ```

2. **Verify Hypothesis 2:** Add logging in `_toCanonicalFullDefinitionResponse` to check for undefined fields

   ```javascript
   const result = { ... };
   const undefinedFields = Object.entries(result).filter(([k, v]) => v === undefined).map(([k]) => k);
   if (undefinedFields.length > 0) {
     ABLogger.getInstance().error('Canonical response has undefined fields', {
       definitionKey: result.definitionKey,
       undefinedFields
     });
   }
   return result;
   ```

3. **Verify Hypothesis 3:** Add logging in `assignmentDefinitionService.ts` to check the parsed response
   ```typescript
   const responseData = await callApi(UPSERT_ASSIGNMENT_DEFINITION_METHOD, parsedRequest);
   ABLogger.getInstance().debug('Upsert response data', {
     data: JSON.stringify(responseData),
   });
   return UpsertAssignmentDefinitionResponseSchema.parse(responseData);
   ```

### Related Changes

Recent commit `6793717` modified schema validation:

- Changed `assignmentWeighting: WeightingSchema` → `assignmentWeighting: WeightingSchema.nullable()` in `AssignmentDefinitionSchema`
- Changed `assignmentWeighting: WeightingSchema.optional()` → `assignmentWeighting: WeightingSchema.optional().nullable()` in `UpsertAssignmentDefinitionRequestSchema`

These changes mean `assignmentWeighting` can now be `null` in both request and response schemas, but **NOT** `undefined`.

### Files to Investigate

1. `src/backend/z_Api/z_apiHandler.js` - Response envelope construction
2. `src/backend/y_controllers/AssignmentDefinitionController.js` - `_toCanonicalFullDefinitionResponse` method
3. `src/backend/Models/AssignmentDefinition.js` - `toJSON()` method
4. `src/frontend/src/services/assignmentDefinitionService.ts` - Response parsing
5. `src/frontend/src/services/assignmentDefinition.zod.ts` - Schema definitions

### Status

- ✅ Frontend error logging updated to include full request payload
- ✅ Backend apiHandler debug logging added for requests/responses
- ⏳ Root cause not yet identified - requires backend logging for the failing save request
- ⏳ Need to verify if `data` field is undefined in response envelope

---

_Generated: 2026-05-21_
_Investigator: Mistral Vibe_
