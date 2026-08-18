# Google Slides AI Assessor Documentation

This documentation provides comprehensive guidance on using, setting up, and understanding the pedagogical foundations of the Google Slides AI Assessor.

---

## 📘 Using the Assessor

[**Guide**](./howTos/README.md) – Step-by-step instructions for the day-to-day usage of the Google Slides AI Assessor.

---

## ⚙️ Setup

[**Setup Instructions**](./setup/README.md) – Detailed guidance on setting up the Google Slides AI Assessor for seamless workflow integration.

---

## 🎓 Pedagogy

[**Pedagogical Overview**](./pedagogy/README.md) – An explanation of the teaching principles supporting the Google Slides AI Assessor and how it can enhance classroom practices.

---

## 👨‍💻 Developer Documentation

Technical documentation for developers contributing to the AssessmentBot codebase:

### Backend

- [**API Layer**](./developer/backend/api-layer.md) – Backend transport handlers, validation ownership, `apiHandler` standards, and endpoint documentation
- [**Backend Logging and Error Handling**](./developer/backend/backend-logging-and-error-handling.md) – Canonical standards for `ABLogger` usage, validation ownership, and error-boundary patterns
- [**Backend Testing Structure**](./developer/backend/backend-testing.md) – Comprehensive guide to backend testing patterns and practices
- [**Data Shapes**](./developer/data-shapes/INDEX.md) – Canonical data-shape specifications for all API contracts
- [**Rehydration**](./developer/backend/rehydration.md) – Guide to deserialising and reconstructing objects
- [**Singleton Pattern**](./developer/backend/singletons.md) – How to work with singletons in the codebase
- [**Vendoring**](./developer/backend/Vendoring.md) – How vendored third-party UI assets are managed
- [**OAuth Scopes**](./developer/backend/oauth-scopes.md) – OAuth scopes required by the application
- [**Assessment Flow**](./developer/backend/AssessmentFlow.md) – Assessment workflow and data flow

### Frontend

- [**Frontend Testing Guidelines**](./developer/frontend/frontend-testing.md) – Lightweight guide to frontend unit and E2E testing
- [**Frontend Logging and Error Handling**](./developer/frontend/frontend-logging-and-error-handling.md) – Canonical standards for frontend diagnostics, error mapping, and user-facing feedback
- [**Frontend Loading and Width Standards**](./developer/frontend/frontend-loading-and-width-standards.md) – Loading states, width-token system, and accessibility-semantics rules
- [**Frontend Modal Patterns**](./developer/frontend/frontend-modal-patterns.md) – Modal component patterns and reuse rules
- [**Frontend React Query and Prefetch**](./developer/frontend/frontend-react-query-and-prefetch.md) – React Query and prefetch patterns
- [**Frontend Shared Helpers and Abstraction Standards**](./developer/frontend/frontend-shared-helpers-and-abstraction-standards.md) – Shared helpers and abstraction standards
- [**Frontend Shell Navigation and Motion**](./developer/frontend/frontend-shell-navigation-and-motion.md) – Shell navigation and motion/accessibility standards

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

### Templates

- [**Specification Template**](./developer/SPEC_TEMPLATE.md) – Template for feature specifications
- [**Layout Specification Template**](./developer/LAYOUT_SPEC_TEMPLATE.md) – Template for frontend layout specifications
- [**Action Plan Template**](./developer/ACTION_PLAN_TEMPLATE.md) – Template for TDD-first delivery plans
- [**Regression CLI Spec**](./developer/regression-cli-spec.md) – Regression checker CLI specification

---
