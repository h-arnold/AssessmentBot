# Slop Review: ACTION_PLAN.md and SPEC.md

**Review Date:** 2026-05-15  
**Reviewer:** De-Sloppification Agent  
**Files Reviewed:** `ACTION_PLAN.md`, `SPEC.md`  
**Status:** **NEEDS IMPROVEMENT**

---

## Summary

The planning documents contain **stale content, duplication, and AI-slop patterns** that reduce maintainability and clarity. While the core planning information is sound and the feature is largely complete, the documents have not been cleaned up to reflect current status. The most critical issues are: (1) duplicate Section 5 entries in multiple places, (2) "Sections Incomplete" and "Sections NOT Started" headers containing items that are actually complete, and (3) a stale "Workflow Restart" section that no longer reflects reality. These should be removed or consolidated before the documents are used as a reference for future work.

---

## Critical Findings

### 1. Stale Section Tracking in ACTION_PLAN.md

**Location:** ACTION_PLAN.md, lines 37-52

**Evidence:**

- "Sections Incomplete" header (line 37) contains Section 5 which is marked as complete elsewhere
- "Sections NOT Started" header (line 41) contains Sections 7, 8, and "Section 5 TypeScript Regression Fixes" which are all marked as complete elsewhere
- All items in both sections are checked (`[x]`) and marked as "REVIEW PASSED" or "FIXES APPLIED"

**Why it matters:**
These sections create confusion about what work remains. The document presents contradictory information about section completion status, making it impossible to determine the true state at a glance. This violates the principle of maintaining a single source of truth for project status.

**Recommended simplification:**

- Remove the "Sections Incomplete" section entirely (all items are complete)
- Remove the "Sections NOT Started" section entirely (all items are complete)
- Keep only the "Sections Implemented and Reviewed" section as the canonical status tracker
- Ensure Section 5 only appears once in the document

---

### 2. Stale Workflow Restart Section

**Location:** ACTION_PLAN.md, lines 94-103

**Evidence:**

```
### Workflow Restart

**CRITICAL:** Previous orchestrator violated mandatory gates. Restarting workflow with proper sequential review/fix loop on each implemented section. Goal: reduce regressions with each completed section review, achieve zero regressions by final section.

**Approach**:

1. Review/fix each implemented section sequentially
2. After each section passes clean code review, rerun regression check
3. Verify regression count decreases or stays at zero
4. Proceed to next section only when current section is clean
```

**Why it matters:**
This section describes a workflow restart that is no longer relevant. All sections have been completed with clean reviews (as stated in the Review/Fix Loop Summary: "Sections Completed with Clean Reviews: 0, 0.5, 1, 2, 3, 3.5, 4, 5, 6, 7, 8 (11 total)"). The workflow has been completed, not restarted. This is dead content that adds noise and could mislead future readers.

**Recommended simplification:**
Remove the entire "Workflow Restart" section. The current status is adequately captured in the "Current Implementation Status" and "Review/Fix Loop Summary" sections.

---

### 3. Duplicate Section 5 Entry

**Location:** ACTION_PLAN.md, lines 16-40 and line 39

**Evidence:**

- Section 5 appears in "Sections Implemented and Reviewed" (line 16) with extensive details
- Section 5 appears again in "Sections Incomplete" (line 39) with abbreviated details

**Why it matters:**
Section 5 is duplicated across two different status sections, creating inconsistency and making it unclear which entry is authoritative. The first entry (lines 16-40) contains detailed information including test results, fixes applied, and complexity/lint fixes. The second entry (line 39) is a brief duplicate.

**Recommended simplification:**
Keep only the detailed Section 5 entry in "Sections Implemented and Reviewed" (lines 16-40). Remove the duplicate from "Sections Incomplete".

---

### 4. Duplicate Section 7 and 8 Entries

**Location:** ACTION_PLAN.md, lines 43-45

**Evidence:**

- Section 7 is marked as complete in "Sections Implemented and Reviewed" (implied by its absence as incomplete)
- Section 8 is marked as complete in "Sections Implemented and Reviewed" (implied by its absence as incomplete)
- Both appear again in "Sections NOT Started" with `[x]` checkboxes and "REVIEW PASSED" status

**Why it matters:**
Sections 7 and 8 cannot simultaneously be "NOT Started" and have "REVIEW PASSED" status. This is contradictory and confusing.

**Recommended simplification:**
Remove Sections 7 and 8 from the "Sections NOT Started" section. They should only appear in the main "Sections Implemented and Reviewed" list.

---

### 5. Redundant TypeScript Regression Fixes Entry

**Location:** ACTION_PLAN.md, line 45-50

**Evidence:**

- "Section 5 — ManageTopicsModal Component TypeScript Regression Fixes" appears in "Sections NOT Started" with detailed fixes listed
- These same fixes are already described in the main Section 5 entry (lines 16-40)

**Why it matters:**
The TypeScript regression fixes for Section 5 are described twice: once as part of the main Section 5 details, and once as a separate item. This is duplication that adds maintenance burden and scan cost.

**Recommended simplification:**
Remove the separate "Section 5 — ManageTopicsModal Component TypeScript Regression Fixes" entry. The fixes are already properly documented within the main Section 5 entry.

---

## Improvement Findings

### 6. Overly Verbose Section Descriptions

**Location:** ACTION_PLAN.md, multiple sections

**Evidence:**
Many acceptance criteria use repetitive patterns like:

- "`createAssignmentTopic` calls `callApi` with method 'createAssignmentTopic'" (lines 581-582)
- "`updateAssignmentTopic` calls `callApi` with method 'updateAssignmentTopic'" (lines 585-586)
- "`deleteAssignmentTopic` calls `callApi` with method 'deleteAssignmentTopic'" (lines 589-590)

**Why it matters:**
These acceptance criteria state the obvious (that a function calls the backend method with the same name) without adding testable value. While some specificity is necessary, the repetitive "calls callApi with method X" pattern adds noise without additional insight.

**Recommended simplification:**
Consolidate repetitive acceptance criteria. For example, instead of:

```
1. `createAssignmentTopic` calls `callApi` with method 'createAssignmentTopic'
2. `updateAssignmentTopic` calls `callApi` with method 'updateAssignmentTopic'
3. `deleteAssignmentTopic` calls `callApi` with method 'deleteAssignmentTopic'
```

Use:

```
1. All CRUD functions call `callApi` with the corresponding backend method name
```

---

### 7. Redundant Dependencies Documentation

**Location:** ACTION_PLAN.md, Section 5 (lines 933-938)

**Evidence:**

```
### Dependencies

- Section 0 — Backend Model Creation (provides AssignmentTopic type understanding)
- Section 0.5 — Backend Controller Update
- Section 1 — Schema and Type Definitions (provides AssignmentTopic type)
- Section 2 — Service Layer Extensions (provides createAssignmentTopic, updateAssignmentTopic, deleteAssignmentTopic)
- Section 3 — Query Options (migrated enriched query contract)
- Section 3.5 — Extend Reference Data Trust Boundary (MUST be complete - hook won't accept 'assignmentTopics' entityKey otherwise)
```

Similar dependency lists appear in SPEC.md (lines 226-231).

**Why it matters:**
While dependency documentation is useful, the same information appears in both documents and within multiple sections of ACTION_PLAN.md. The Section 5 dependencies are restated in the "Key dependencies" section later in the document.

**Recommended simplification:**

- Keep dependency lists in ACTION_PLAN.md sections concise
- Reference SPEC.md for detailed dependency rationale rather than duplicating it

---

### 8. Redundant Helper Decision Documentation

**Location:** ACTION_PLAN.md, multiple "Shared helper plan" sections

**Evidence:**
Each section contains a "Shared helper plan" subsection that documents helper decisions with fields like:

- Decision: `new`/`extend`/`reuse`
- Owning module/path
- Call-site rationale
- Relevant canonical doc target
- Planned doc status

Many of these entries document decisions that have already been implemented, yet retain "Planned doc status: `Not implemented`".

**Why it matters:**
The helper planning structure is valuable for pre-implementation clarity, but becomes stale slop when:

- Decisions are marked as "Not implemented" but the code exists
- The same helper is documented in multiple sections (e.g., SelectWithAddNew appears in Section 6 and Section 7)
- The documentation doesn't reflect actual implementation status

**Recommended simplification:**

- Update "Planned doc status" fields to reflect actual implementation state
- Remove redundant helper entries (e.g., SelectWithAddNew integration is documented in both Section 6 and Section 7)
- Consider moving implemented helper decisions to a separate "Implemented Helpers" section or removing the planning structure entirely for completed work

---

### 9. Overly Detailed Acceptance Criteria for Obvious Behavior

**Location:** ACTION_PLAN.md, Section 6 (lines 1138-1152)

**Evidence:**
Acceptance criteria include items like:

- "SelectWithAddNew renders standard Select without onAddNew prop"
- "SelectWithAddNew renders 'Add new' option when onAddNew prop provided"
- "'Add new' option appears at bottom of dropdown with PlusOutlined icon"

**Why it matters:**
Some acceptance criteria document behavior that is inherently obvious from the component's purpose and API. While these may have been useful during initial planning, they add scan cost without providing meaningful testable constraints beyond what the type signature already enforces.

**Recommended simplification:**
Focus acceptance criteria on non-obvious behavior, edge cases, and integration points. Remove criteria that merely restate the component's purpose.

---

### 10. Redundant Content Between ACTION_PLAN.md and SPEC.md

**Location:** Both documents, various sections

**Evidence:**

- The `yearGroupKeys` field description appears in both documents with nearly identical wording
- The ReferenceDataTrustBoundary extension requirement appears in both documents
- Service function naming conventions are explained in both documents
- The canonical topic contract `{ key, name, yearGroupKeys }` is repeated in both documents

**Why it matters:**
While some overlap between SPEC.md and ACTION_PLAN.md is expected and necessary (SPEC defines what, ACTION_PLAN defines how), there are areas where the same explanatory text appears in both documents. This creates a maintenance burden: changes must be made in two places.

**Recommended simplification:**

- Keep contractual definitions (what the system must do) in SPEC.md
- Keep implementation details (how it will be built) in ACTION_PLAN.md
- Use references between documents (e.g., "See SPEC.md Section X for contractual details") instead of duplicating text

---

## Nitpick Findings

### 11. Inconsistent Date Formatting

**Location:** ACTION_PLAN.md, line 4

**Evidence:**

```
**LAST UPDATED:** 2026-05-15T16:30:00.000Z
```

**Why it matters:**
Cosmetic issue only. The ISO 8601 format is technically correct but includes unnecessary precision (milliseconds and timezone).

**Recommended simplification:**
Use `2026-05-15` or `2026-05-15T16:30:00Z` (without milliseconds) for consistency with typical documentation practices.

---

### 12. Emoji Usage (⚠️)

**Location:** ACTION_PLAN.md, line 910

**Evidence:**

```
**⚠️ WARNING**: This section CANNOT be implemented until Section 3.5...
```

**Why it matters:**
Minor style issue. The repository's AGENTS.md specifies "Use British English in comments, docs, and user-facing text" but doesn't explicitly address emoji. However, emoji in technical documentation can be inconsistent across platforms and may not render correctly in all markdown viewers.

**Recommended simplification:**
Use text-only warnings: "**WARNING:**" without the emoji, which is consistent with other warnings in the document (e.g., line 97: "**CRITICAL:**").

---

### 13. Redundant Parentheses

**Location:** ACTION_PLAN.md, multiple locations

**Evidence:**

- "(from referenceDataService)" appears multiple times where the module is already clear from context
- "(from sharedQueries)" appears in contexts where it's already established

**Why it matters:**
Minor readability issue. Excessive parenthetical clarification adds visual noise.

**Recommended simplification:**
Remove redundant parenthetical clarifications where the source is already clear from the immediate context.

---

## Files Read

Mandatory documentation consulted for this review:

1. **AGENTS.md** - `/home/developer/AssessmentBot/AGENTS.md` - Core agent contract and principles
2. **ACTION_PLAN.md** - `/home/developer/AssessmentBot/ACTION_PLAN.md` - Full document under review
3. **SPEC.md** - `/home/developer/AssessmentBot/SPEC.md` - Full document under review
4. **DRIFT_AND_SLOP_REFERENCE_REPORT.md** - `/home/developer/AssessmentBot/DRIFT_AND_SLOP_REFERENCE_REPORT.md` - Reference for slop patterns and review standards

---

## Validation

- Review performed against canonical slop definitions in DRIFT_AND_SLOP_REFERENCE_REPORT.md
- All findings classified according to priority: Critical > Improvement > Nitpick
- Each finding includes: location, evidence, impact, recommended simplification
- No code execution required for this documentation-only review

---

## Conclusion

**Overall Status: NEEDS IMPROVEMENT**

The ACTION_PLAN.md document contains **significant stale content and duplication** that must be cleaned up. The SPEC.md document is cleaner but contains some redundant information that overlaps with ACTION_PLAN.md.

**Critical Issues (5):** All are in ACTION_PLAN.md and relate to stale section tracking, duplicate entries, and the outdated workflow restart section. These create confusion about project status and must be addressed.

**Improvement Issues (5):** Verbose acceptance criteria, redundant dependency documentation, stale helper planning entries, and overlap between documents. These increase maintenance burden and scan cost.

**Nitpick Issues (3):** Minor style and formatting inconsistencies.

**Recommendation:** Clean up ACTION_PLAN.md by removing stale sections, consolidating duplicate entries, and streamlining verbose acceptance criteria before using these documents as references for future work. The SPEC.md requires less cleanup but would benefit from reducing overlap with ACTION_PLAN.md.
