# Assessment Bot

**A tool designed by a Digital Technology and Computer Science teacher (and head of department) to simplify tracking and assessing the work of hundreds of students.**

**[Read the Documentation Here](./docs/README.md)**

Applying the **Pareto Principle** in spirit, this tool automates 80% of the effort—checking and scoring student work—so teachers can focus on the most impactful 20%: acting on insights to improve learning.

This tool pulls Google Slides from Google Classroom assignments and evaluates them on **Completeness**, **Accuracy**, and **SPaG** (Spelling, Punctuation, and Grammar), scoring each out of 5.

- [Assessment Bot](#assessment-bot)
  - [🎯 Key Features](#-key-features)
  - [📸 The New React Frontend](#-the-new-react-frontend)
    - [Create a new assessment](#create-a-new-assessment)
    - [Classes overview](#classes-overview)
    - [Run a new assessment](#run-a-new-assessment)
    - [Assignments page](#assignments-page)
    - [Task Heatmap](#task-heatmap)
    - [Cell-level evidence](#cell-level-evidence)
    - [Heatmaps builder](#heatmaps-builder)
  - [🛠️ How It Works](#️-how-it-works)
  - [🔒 Privacy and Security](#-privacy-and-security)
  - [❓ What Can It Assess?](#-what-can-it-assess)
  - [🤔 Is It Perfect?](#-is-it-perfect)
  - [💸 Cost?](#-cost)
  - [⚙️ Setup](#️-setup)
  - [🤝 Contributing](#-contributing)
  - [🚀 Why Use This Tool?](#-why-use-this-tool)

---

## 🎯 Key Features

- **Automated Assessment**: Quickly evaluates student submissions against a reference and template.
- **Customisable Marking**: Identify key elements for assessment using Alt Text markers:
  - `#` for text or tables
  - `~` or `|` for images
- **Visual Feedback**: Provides a colour-coded task heatmap so you can see at a glance who is on track and who needs help.
- **Detailed Reporting**: Presents a class-level overview plus per-task breakdowns with:
  - Student scores (Completeness, Accuracy, SPaG)
  - Cell-level evidence: click any cell to see the AI reasoning and the student's original response
  - Performance averages across assignments
- **Future-Proof**: A department-wide Quality Assurance view is in development.

---

## 📸 The New React Frontend

v1 ships with a brand new browser-based admin UI that replaces the old Google Sheets admin surface. Every screen below is a real view from the React app, captured via Playwright.

### Create a new assessment

The end-to-end happy path: from a class page, kick off a new assessment, and walk the wizard to define the assessment.

**1. Open the class page and click "Start New Assessment".**

<img src="/docs/images/react-wizard-1-class-page.png" alt="Class page with the Start New Assessment button" width="80%">

**2. Pick the Google Classroom assignment to assess.**

<img src="/docs/images/react-wizard-2-assess-modal.png" alt="Assess Task modal with the assignment selector" width="80%">

**3. Fill in the wizard — title, topic, year group, and the reference/template document URLs.**

<img src="/docs/images/react-wizard-3-stage1-form.png" alt="Create assignment wizard stage 1 — form fields" width="80%">

**4. The tool parses the documents, surfaces the extracted tasks, and you save.**

<img src="/docs/images/react-wizard-4-stage2-tasks.png" alt="Create assignment wizard stage 2 — parsed tasks ready to save" width="80%">

### Classes overview

Classes are grouped by year group, with each card offering one-click access to the class page and to a fresh assessment run.

<img src="/docs/images/react-classes-overview.png" alt="Classes overview grouped by year group" width="80%">

### Run a new assessment

Pick a Google Classroom assignment, kick off the run, and either create a new assignment definition inline or link to an existing one.

<img src="/docs/images/react-assess-task-modal.png" alt="Assess Task modal showing the choice prompt after starting an assessment" width="80%">

### Assignments page

Every assignment definition is listed in one table. Filter, sort, update, or permanently delete obsolete entries from the same surface.

<img src="/docs/images/react-assignments-table.png" alt="Assignment definitions table" width="80%">

Destructive actions are confirmed in a dedicated dialog so accidental clicks never silently lose work.

<img src="/docs/images/react-assignments-delete-modal.png" alt="Delete assignment definition confirmation dialog" width="80%">

### Task Heatmap

The per-class detail page exposes a per-task, per-student heatmap. Each task is broken into Completeness, Accuracy and SPaG sub-columns, with banded colour coding that surfaces who is on track and who needs support at a glance.

<img src="/docs/images/react-task-heatmap.png" alt="Task heatmap for a class assignment" width="80%">

### Cell-level evidence

Every heatmap cell is a button. Click it to inspect the AI's reasoning alongside the student's actual work — in whatever form the student produced it: an image of a slide, a text response, or a table.

<table>
  <tr>
    <td><img src="/docs/images/react-task-preview-image.png" alt="Image preview popover for a Completeness cell" width="280"></td>
    <td><img src="/docs/images/react-task-preview-text.png" alt="Text preview popover for an Accuracy cell" width="280"></td>
    <td><img src="/docs/images/react-task-preview-table.png" alt="Table preview popover for a SPaG cell" width="280"></td>
  </tr>
  <tr>
    <td align="center"><b>Image</b><br>Slide captures and diagrams</td>
    <td align="center"><b>Text</b><br>Markdown reasoning</td>
    <td align="center"><b>Table</b><br>Rendered tabular data</td>
  </tr>
</table>

### Heatmaps builder

Build a cross-assignment heatmap by picking a class, a topic, and the assignments to merge. The same per-cell evidence flow is available on the merged table.

<img src="/docs/images/react-heatmaps-builder.png" alt="Heatmaps builder empty state" width="80%">

---

## 🛠️ How It Works

1. **Preparation**:
   - Create a **perfect reference** with all tasks completed correctly.
   - Provide a **blank template** for students to complete.
2. **Marking Tasks**: Use Alt Text markers (e.g. `Task 1 – Do this thing`) to identify the parts to assess.
3. **Assessment**:  
   The tool pulls student submissions from Google Classroom and uses `Gemini Flash 2.5` to:
   - Compare submissions to the reference
   - Score based on Completeness, Accuracy, and SPaG
   - Validate spreadsheet formulae and provide visual feedback
4. **Reporting**:  
   Results are compiled into a beautifully formatted spreadsheet heatmap (because SLT loves spreadsheets—admit it, so do you). The sheet includes:
   - Individual scores
   - Work previews
   - Class-wide averages

---

## 🔒 Privacy and Security

Your students’ privacy is a top priority. Here's how their data is protected:

- **No intentional sharing of PII**: The tool only processes data within the user’s Google Workspace account, managed by the educational institution.
- **Mitigations against accidental PII submission**:
  - **Ephemeral image storage**: The AssessmentBot LLM Service is stateless when deployed to a serverless platform, ensuring uploaded images exist only temporarily during processing.
  - **GDPR compliance**: The tool integrates with the GDPR-compliant version of the Gemini Flash API. While this comes with a small cost, it ensures adherence to strict privacy standards.
- **FOSS Transparency**: The entire tool, including the Langflow backend, is **free and open-source software (FOSS)**. If you don’t trust my word, you can inspect the source code yourself!
- **HWB Ready**: The tool works seamlessly with HWB accounts! 🏴‍☠️

By design, this tool minimises any long-term storage of student data and maintains a secure, private workflow.

---

## ❓ What Can It Assess?

The tool works with:

- **Text**
- **Tables** (converted to Markdown for easier processing)
- **Slide Images**
- **Spreadsheets** (including formula checking with visual feedback)

It’s been tested successfully on:

- **Factual content**
- **Block code** (e.g., MakeCode for Microbit)
- **Basic persuasive writing**
- **Posters** (with a view to assessing the application of design principles)
- **Spreadsheet tasks** (with formula validation and formatting)

---

## 🤔 Is It Perfect?

Not quite. While **LLMs aren’t infallible**, the tool is reliable enough to provide a snapshot of:

- Who’s on track
- Who needs extra support

It’s still up to you to address misconceptions, motivate students, and do all those good old-fashioned teachery things.

---

## 💸 Cost?

**Surprisingly low.** Google Gemini Flash costs around **£2–3 per month**, which easily covers monitoring ~25 classes. Hosting the Langflow backend on Google Cloud Run is similarly affordable.

---

## ⚙️ Setup

The initial set up should take no more than an hour, including deploying the backend and creating all the Assessment Records.

Check out the [docs](./docs/README.md) for more details.

---

## 🛠️ Development

The project has three active modules, each with its own runtime:

| Module   | Path               | Runtime                |
| -------- | ------------------ | ---------------------- |
| Backend  | `src/backend/`     | Google Apps Script V8  |
| Frontend | `src/frontend/`    | Browser (Vite + React) |
| Builder  | `scripts/builder/` | Node.js                |

Useful commands:

- `npm run build:dev`
- `npm run build:frontend`
- `npm run lint:frontend`
- `npm run test:frontend`
- `npm run test:frontend:e2e`
- `npm run lint:backend`
- `npm run test:backend`

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full developer guide.

---

## 🤝 Contributing

Contributions are very welcome!  
If you have ideas, improvements, or bug fixes, feel free to open a **Pull Request (PR)**.

Some areas we’d particularly appreciate help with:

- Improving setup simplicity
- Expanding documentation
- Refining the Quality Assurance view

---

## 🚀 Why Use This Tool?

- Save time while managing hundreds of students.
- Get actionable insights at a glance.
- Use it for everything from basic content checks to QA-ready reporting.

Feedback and contributions are welcome—this project is a work in progress!
