# Assessment Bot Documentation

Guides for setting up Assessment Bot, using it, and understanding its scoring model.

---

## Using the Assessor

Step-by-step guides for day-to-day use of Assessment Bot:

- [**Prepare and Distribute Tasks**](./howTos/prepare-tasks/index.md) – Create a template, tag tasks and attach it to a classroom assignment.
- [**Run an Assessment**](./howTos/run-an-assessment/index.md) – Create an assignment definition and start a marking run.
- [**View Results**](./howTos/view-results/index.md) – Read averages, heatmaps and task feedback.
- [**Manage Assignment Definitions**](./howTos/manage-assignment-definitions/index.md) – Update or remove saved definitions.

---

## Setup

- [**Setup Instructions**](./setup/README.md) – Detailed guidance on setting up Assessment Bot.
- [**Configuration Options**](./setup/configOptions.md) – Detailed configuration options.
- [**Setting Up Assessment Records**](./setup/settingUpAssessmentRecords.md) – Guide for setting up assessment records.

---

## Pedagogy

- [**Pedagogy Overview**](./pedagogy/README.md) – The teaching principles behind Assessment Bot.
- [**Data Analysis and Scoring**](./pedagogy/data-analysis-scoring.md) – Guide to data analysis and scoring approaches.

---

## Developer Documentation

Technical documentation for developers contributing to the Assessment Bot codebase:

### Backend

- [**API Layer**](./developer/backend/api-layer.md) – Backend transport handlers, validation ownership, `apiHandler` standards, and endpoint documentation
- [**Backend Logging and Error Handling**](./developer/backend/backend-logging-and-error-handling.md) – Canonical standards for `ABLogger` usage, validation ownership, and error-boundary patterns
- [**Backend Testing**](./developer/backend/backend-testing.md) – Backend test runtime model, layout, fixtures, harness rules and anti-patterns
- [**Backend File Organisation**](./developer/backend/backend-file-organisation.md) – Facade-pattern decomposition and `z_Api` domain-folder conventions
- [**Data Shapes**](./developer/data-shapes/INDEX.md) – Canonical data-shape specifications for all API contracts
- [**Rehydration**](./developer/backend/rehydration.md) – Guide to deserialising and reconstructing objects
- [**Singleton Pattern**](./developer/backend/singletons.md) – How to work with singletons in the codebase
- [**Vendoring**](./developer/backend/Vendoring.md) – How the vendored JsonDbApp snapshot is managed
- [**OAuth Scopes**](./developer/backend/oauth-scopes.md) – OAuth scopes required by the application
- [**Assessment Flow**](./developer/backend/AssessmentFlow.md) – Assessment workflow and data flow

### Frontend

- [**Frontend Architecture**](./developer/frontend/frontend-architecture.md) – Domain-folder, feature-directory, file-splitting, and transport-boundary conventions
- [**Data Analysis Architecture**](./developer/frontend/data-analysis-architecture.md) – Analyser pipeline and heatmap projection architecture
- [**Frontend Testing**](./developer/frontend/frontend-testing.md) – Guide to frontend unit and E2E testing
- [**Frontend Logging and Error Handling**](./developer/frontend/frontend-logging-and-error-handling.md) – Canonical standards for frontend diagnostics, error mapping, and user-facing feedback
- [**Frontend Loading and Width Standards**](./developer/frontend/frontend-loading-and-width-standards.md) – Loading states, width-token system, and accessibility-semantics rules
- [**Frontend Modal Patterns**](./developer/frontend/frontend-modal-patterns.md) – Modal component patterns and reuse rules
- [**Frontend React Query and Prefetch**](./developer/frontend/frontend-react-query-and-prefetch.md) – React Query and prefetch patterns
- [**Frontend Shared Helpers and Abstraction Standards**](./developer/frontend/frontend-shared-helpers-and-abstraction-standards.md) – Shared helpers and abstraction standards
- [**Frontend Shell Navigation and Motion**](./developer/frontend/frontend-shell-navigation-and-motion.md) – Shell navigation and motion/accessibility standards
- [**Frontend Spacing and Padding Standards**](./developer/frontend/frontend-spacing-and-padding-standards.md) – Spacing tokens, 8px grid, component defaults
- [**Frontend Playwright E2E**](./developer/frontend/frontend-playwright-e2e.md) – Playwright E2E testing patterns, runtime mock infrastructure, StrictMode
- [**Metric Display Precision**](./developer/frontend/metric-display-precision.md) – Metric score decimal-place convention (0dp individual, 2dp averages)
- [**Metric Icon Display**](./developer/frontend/metric-icon-display.md) – Metric icon rendering, theme-aware colour, stroke conventions
- [**Page Header and Navigation Pattern**](./developer/frontend/page-header-navigation-pattern.md) – Page title/nav cards, stacking and page-level actions

> The `frontend/ant-design-docs-cache/` directory holds a local cache of Ant Design component notes for offline reference. It is not canonical policy.

### Testing

- [**Synthetic Test Data**](./developer/testing/synthetic-test-data.md) – Architecture and fixture policy for the synthetic analysis corpus, its profiles/views and commands

### Architecture

- [**YearGroupKey ADR**](./architecture/YearGroupKey.md) – Architecture Decision Record: yearGroupKey-only with Controller-Resolution Pattern

### Security

- [**Security Approach**](./developer/security/README.md) – Overview of the defence-in-depth security model, threat model, and layer summaries
- [**Platform Security**](./developer/security/platform-security.md) – Layer 1: GAS deployment mode, OAuth scopes, Drive permissions, trigger execution model
- [**Application Authentication**](./developer/security/application-authentication.md) – Layer 2: the `AuthService` Google Group gate, caching, audit logging
- [**Attack-Surface Reduction**](./developer/security/attack-surface-reduction.md) – Layer 3: private-by-default functions, sole transport, envelope hygiene
- [**Data-Handling Discipline**](./developer/security/data-handling.md) – Layer 4: no durable client storage, server-side persistence, logging hygiene
- [**Accepted Risks and Trade-offs**](./developer/security/accepted-risks.md) – Accepted risks, justifications, and future security direction

### Builder

- [**Builder Script**](./developer/builder/builder-script.md) – How to use the build pipeline and how each stage works internally
- [**Regression Checker How-To**](./developer/builder/regression-checker-how-to.md) – Configure, run, compare, and troubleshoot deterministic lint/test/compile regression checks
- [**TypeScript and Lint Config Hierarchy**](./developer/builder/TypeScriptAndLintConfigHierarchy.md) – TypeScript and ESLint configuration hierarchy

### Documentation standards

- [**Documentation Style Guide**](./developer/documentation-style-guide.md) – Writing rules for canonical docs, ADRs and review exclusions
- [**Teacher Documentation Workflow**](./developer/teacher-documentation-workflow.md) – When a change needs a teacher tutorial or explainer, and how to produce one

### Templates

- [**Specification Template**](./developer/SPEC_TEMPLATE.md) – Template for feature specifications
- [**Layout Specification Template**](./developer/LAYOUT_SPEC_TEMPLATE.md) – Template for frontend layout specifications
- [**Feature Delivery Plan (TDD-First)**](./developer/ACTION_PLAN_TEMPLATE.md) – Template for TDD-first delivery plans
- [**Regression CLI Spec**](./developer/regression-cli-spec.md) – Regression checker CLI specification

- [**Known Flaky Tests**](./developer/known-flaky-tests.md) – Catalogue of known flaky tests and their root causes

---

## Release Notes

[**Release Notes Index**](./releaseNotes/RELEASES.md) – Index of all versioned release notes.

---
