# Drift and Slop Hardening Reference Report

## 1. Purpose of this document

This is a detailed reference record of the drift-control and anti-slop work completed on the `feat/ReactFrontend` branch during this cycle.

It is intentionally comprehensive and detailed so it can later be distilled into a shorter public-facing narrative (for example, a LinkedIn article) without losing operational nuance.

This report covers:

- baseline conditions before changes
- identified failure modes and policy gaps
- changes made (with rationale)
- enforcement model and expected runtime behaviour
- residual risks and follow-up recommendations

## 2. Baseline state before this hardening cycle

### 2.1 Observed slop profile (from SLOP_REVIEW)

The review identified recurring patterns consistent with completion-driven generation rather than long-horizon maintainability:

- repeated orchestration and repeated plumbing blocks
- single-caller abstraction extraction that added naming indirection without reducing duplication
- duplicated routing/rendering sources of truth
- repeated validation wiring and mirrored error-state bookkeeping
- comment/noise traces that increase scan cost without adding behavioural value

The report also identified strong precedents worth preserving (for example, contracts that genuinely reduce duplication), and explicitly warned against standardising one-caller wrappers.

### 2.2 Policy/documentation topology before updates

Frontend policy existed, but was spread across topic-specific docs:

- loading/width semantics
- logging/error handling
- React Query/prefetch policy
- shell navigation/motion
- testing policy

What was missing at baseline:

- one explicit canonical doc for shared-helper discovery and abstraction decision standards
- a formal pre-implementation planning requirement for helper decisions
- a hard orchestrator gate requiring evidence that sub-agents read mandatory documentation

### 2.3 Agent-contract baseline before updates

Before hardening, several contracts had good intent but inconsistent enforceability:

- sub-agent context requirements existed, but handoff evidence requirements were not strict enough everywhere
- action planning was TDD-first, but did not force section-level helper planning and planned-entry lifecycle discipline
- docs and de-sloppification agents did not consistently treat policy drift as a first-class blocking concern
- planner/planner-reviewer contracts did not explicitly require planned shared-helper documentation before implementation

## 3. Key drift vectors identified

1. **Context acquisition drift**
   Agents could claim standards were read without explicit path evidence.

2. **Policy-routing drift**
   Canonical docs existed, but there was no single helper abstraction policy and no mandatory planning path for helper changes.

3. **Planning-to-implementation drift**
   Helper decisions could be made ad hoc during implementation instead of being constrained in planning artefacts first.

4. **Review drift**
   Slop checks could remain style-heavy instead of policy-heavy if canonical policy alignment was not explicit.

5. **Mirror drift between `.github` and `.codex`**
   Behavioural parity is required by contract, but needed stronger explicit checks in update workflows.

## 4. Strategy used in this cycle

The hardening strategy combined four control layers:

1. **Canonical policy introduction and conflict repair**
   - Add explicit helper/abstraction policy surface
   - fix contradictory reviewer rule around Ant Design patching

2. **Orchestration fail-closed evidence gate**
   - require `Files read` with explicit paths
   - block phase progression when mandatory-read evidence is incomplete

3. **Planning-time helper intent capture**
   - require helper decisions before implementation starts
   - keep implementation status out of `SPEC.md`
   - track planned helper entries in relevant canonical docs as `Not implemented`

4. **End-of-cycle reconciliation discipline**
   - docs pass must reconcile planned helper entries with delivered work
   - de-sloppification must treat canonical-policy deviations as first-class findings

## 5. Changes delivered in this cycle

### 5.1 New canonical frontend helper standard (draft)

- Added:
  - `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

This draft establishes:

- reuse-first decision rules (`reuse`/`extend`/`new`/`keep local`)
- canonical helper map (query, errors, logging, feature-local precedents, test helpers)
- anti-patterns (single-caller wrapper extraction, duplicated orchestration, duplicate routing sources, mirrored validation state)
- review and PR check expectations for helper changes

### 5.2 Ant Design policy conflict correction

- Updated reviewer contract to align with frontend policy:
  - Ant Design v6 does not require `@ant-design/v5-patch-for-react-19`
  - adding the patch is treated as regression unless explicitly documented

### 5.3 Core delegation contract and orchestrator enforcement

Changes were made across:

- `AGENTS.md`
- `.github/agents/agent-orchestrator.agent.md`
- `.codex/agents/agent_orchestrator.toml`

Enforcement additions:

- sub-agent prompts must include mandatory docs
- sub-agent handoffs must include `Files read` with explicit file paths
- orchestrator must verify mandatory-read completeness before accepting handoff
- orchestrator must return work to the same sub-agent when mandatory docs are missing
- missing mandatory-read evidence is a blocking failure, not a warning

Prompt templates were also updated to require `Files read (mandatory)` and explicit `Files read` deliverables.

### 5.4 ACTION_PLAN template hardening

- Updated `docs/developer/ACTION_PLAN_TEMPLATE.md`

New controls added:

- delegation mandatory-read gate
- section-level mandatory docs placeholders by agent
- section check requiring mandatory-read gate completion
- regression/docs phases now verify mandatory-read evidence

### 5.5 Docs and de-sloppification contract hardening

Updated in parity pairs:

- `.github/agents/docs.agent.md`
- `.codex/agents/docs.toml`
- `.github/agents/de-sloppification.agent.md`
- `.codex/agents/de_sloppification.toml`

#### Docs agent improvements

- explicit policy-drift setup and final policy-drift check
- explicit `.github`/`.codex` parity verification when agent files change
- handoff must include explicit `Files read`
- reporting now includes:
  - policy updates made
  - policy updates intentionally not made (with rationale)
  - potential policy-drift risks

#### De-sloppification improvements

- canonical policy docs must be read before judgement
- policy deviations now first-class slop category
- reporting must include violated policy/rule, impact, required correction, blocker status
- review cannot be marked clean with unresolved canonical-policy deviations
- completion must include explicit `Files read`

### 5.6 Planner and planner-reviewer pre-implementation helper planning

Updated in parity pairs:

- `.github/agents/planner.agent.md`
- `.codex/agents/planner.toml`
- `.github/agents/planner-reviewer.agent.md`
- `.codex/agents/planner_reviewer.toml`

Planner now requires:

- identify shared-helper/abstraction decisions before implementation
- record planned-only helper entries in relevant canonical docs as `Not implemented`
- keep implementation status tracking out of `SPEC.md`
- include per-section helper planning in `ACTION_PLAN.md` when relevant

Planner Reviewer now checks for:

- missing helper planning where duplication risk exists
- misuse of `SPEC.md` as implementation-status tracker
- action plans that omit helper planning and planned-doc-entry requirements when relevant

### 5.7 Docs pass reconciliation with planned helper entries

Docs contracts and `ACTION_PLAN_TEMPLATE.md` were extended so end-of-cycle documentation review must:

- reconcile planned helper entries in canonical docs
- keep pending items as `Not implemented`
- update entries for implemented items

## 6. Commits produced in this cycle

The following commits were created and pushed during this hardening programme:

1. `80ffd1b` — `docs(frontend): add draft shared helper standards`
2. `fa0a030` — `docs(reviewer): align Ant Design v6 patch guidance`
3. `b2ccaa9` — `docs(contracts): enforce mandatory sub-agent read evidence`
4. `1f7011b` — `docs(agents): enforce policy-drift checks in docs and slop review`
5. `577088e` — `docs(agents): tighten orchestration and pre-implementation helper planning`

Additional report commit follows this document.

## 7. Before vs after: operational control model

### 7.1 Before

- read requirements existed but evidence was weak
- planning docs did not force helper intent capture in a standard form
- helper policy was fragmented
- slop review could miss policy deviations if code looked tidy
- docs pass could complete without explicit planned-vs-implemented helper reconciliation

### 7.2 After

- read requirements are evidence-backed (`Files read` + fail-closed checks)
- orchestrator blocks progression on missing mandatory docs
- helper planning is required before implementation when relevant
- planned helper entries are documented early in canonical docs as `Not implemented`
- docs pass is required to reconcile planned entries after implementation cycles
- slop review treats policy deviations as blocking findings

## 8. Governance and anti-drift benefits

1. **Better determinism in agent behaviour**
   Prompt contracts now require concrete evidence and make non-compliance observable.

2. **Reduced ad-hoc abstraction decisions**
   Helper choices are made in planning and reflected in canonical docs before coding.

3. **Safer contract evolution**
   Policy drift must be explicitly acknowledged and resolved, not silently accumulated.

4. **Lower review ambiguity**
   De-sloppification and docs review now share a policy-centric vocabulary.

5. **Improved parity discipline**
   `.github` and `.codex` alignment is now operationally visible in docs workflow.

## 9. Remaining risks and constraints

1. **Adoption lag risk**
   New contract text can exist before all contributors consistently follow it.

2. **Template compliance risk**
   The action-plan template now supports helper-planning gates, but execution quality still depends on planner discipline.

3. **Canonical doc curation risk**
   Planned helper entries in canonical docs need active pruning and maintenance to avoid stale “planned” clutter.

4. **Scope creep risk in policy docs**
   Canonical helper policy should remain focused and avoid becoming an implementation log.

## 10. Recommendations for next phase

1. Add a lightweight checklist in PR descriptions for helper/abstraction changes:
   - helper decision taken (`reuse`/`extend`/`new`/`keep local`)
   - canonical doc entry added/updated
   - planned/implemented state reconciled

2. During next slop audit, explicitly measure:
   - number of new one-caller wrappers
   - number of duplicated orchestration blocks introduced
   - number of planned helper entries reconciled vs left pending

3. Add periodic parity audit between `.github/agents/*` and `.codex/agents/*` as a recurring maintenance task.

4. Decide when to graduate `frontend-shared-helpers-and-abstraction-standards.md` from draft to canonical policy.

## 11. Suggested structure for a future public article

This document can be condensed into a narrative with this arc:

1. Problem: slop patterns appear even in disciplined codebases.
2. Diagnosis: policy existed, enforcement did not.
3. Intervention: turn intentions into explicit evidence gates.
4. Mechanism: planning-time helper intent + end-of-cycle reconciliation.
5. Outcome: reduced drift probability without heavy process overhead.
6. Lessons: keep contracts tight, evidence explicit, and policy/docs/agents in lockstep.

## 12. Closing summary

The primary shift in this cycle was from **advice** to **enforceable workflow contracts**:

- mandatory reads became verifiable evidence
- missing evidence became blocking, not advisory
- helper decisions moved left into planning
- planned helper documentation became a managed lifecycle
- docs and slop review became policy-aware reconciliation steps

This does not eliminate drift entirely, but it materially improves early detection and reduces the probability that duplication and weak abstractions become normalised across agent-driven delivery.
