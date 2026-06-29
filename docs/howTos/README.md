# 📝 Using Assessment Bot

- [📝 Using Assessment Bot](#-using-assessment-bot)
  - [📋 What You Need](#-what-you-need)
  - [🏷️ Tagging](#️-tagging)
    - [Google Slides Tagging](#google-slides-tagging)
      - [🔖 How to Tag a Task for Assessment](#-how-to-tag-a-task-for-assessment)
        - [📝 Text or Table Tasks](#-text-or-table-tasks)
        - [🖼️ Image Tasks](#️-image-tasks)
    - [Google Sheets Tagging](#google-sheets-tagging)
  - [📤 Distributing Tasks to Your Students](#-distributing-tasks-to-your-students)
  - [🔍 Assessing Student Work](#-assessing-student-work)
    - [✅ Prerequisites](#-prerequisites)
    - [🆔 Getting the Slide IDs](#-getting-the-slide-ids)
    - [⚙️ The Assessment Process](#️-the-assessment-process)

## 📋 What You Need

Using Assessment Bot is straightforward. To assess a piece of work, you need three things:

1. **The Slide Template**: The blank template you distribute to your students on Google Classroom.
2. **The Reference Slides**: The completed version of the blank template that the Slides Assessment Bot will compare the students' work against. It should represent what you would score a `5` for completeness, accuracy, and SPaG (spelling, punctuation, and grammar).
3. **The Students' Work**: This should be the same as the blank template but completed by your students and attached to a Google Classroom assignment.

---

## 🏷️ Tagging

### Google Slides Tagging

For Assessment Bot to identify which parts of the document to assess, the relevant sections need to be "tagged." At present, the following tags are supported:

| Tag  | Used on     | Purpose                                                        |
| ---- | ----------- | -------------------------------------------------------------- |
| `#`  | Text shapes | Marks a text element for assessment.                           |
| `#`  | Tables      | Marks a table element for assessment.                          |
| `~`  | Images      | Marks an image on a slide for assessment as an image task.     |
| `\|` | Images      | Alternative image tag (behaves the same as `~`).               |
| `^`  | Text shapes | Marks a text element containing notes/instructions for a task. |

> 💡 **Tip:** Assessing whole slide images is slower and potentially less accurate than text or table-based assessments. If your task is text or table-based only, ensure you tag it accordingly.

#### 🔖 How to Tag a Task for Assessment

> 💡 **Tip:** Create the _Slide Template_ first and tag that. Then, make a copy and add your answers to create the _Reference Slides_. This ensures tagging consistency.

##### 📝 Text or Table Tasks

1. Open or create the template.
2. Select the textbox or table you want to assess.
3. Press `Ctrl` + `Alt` + `Y` to open the formatting options.
4. Select **Alt Text**.
5. In the **Description Box**, add your tag, e.g.:
   - `# Task 1 - Fill in the gaps`
   - `# Task 2 - Meaning of life`

##### 🖼️ Image Tasks

1. Open or create the template.
2. Select the image you want to assess.
3. Press `Ctrl` + `Alt` + `Y` to open the formatting options.
4. Select **Alt Text**.
5. In the **Description Box**, add your tag, e.g.:
   - `~ Task 1 - Complete this diagram`
   - `~ Task 2 - Sequence Block Code`

> **Note:** You can have text, table, and image tasks in the same document.

##### 📝 Notes Tags

Notes tags allow you to attach guidance or instructions to a task. The tagged text is stored as task notes and can assist with assessment context.

1. Open or create the template.
2. Select the textbox containing the notes or instructions.
3. Press `Ctrl` + `Alt` + `Y` to open the formatting options.
4. Select **Alt Text**.
5. In the **Description Box**, add the tag and the title of the task it relates to, e.g.:
   - `^ Task 1 - Fill in the gaps`

> **Note:** Notes tags (`^`) must reference an existing task title that is already tagged with `#`, `~`, or `|`.

### Google Sheets Tagging

At present, there's no need to tag anything in Google Sheets. Assessment Bot currently supports the checking whether formulae in a spreadsheet are:

- Correct,
- Incorrect
- Not attempted.

It determines this by comparing the formulae in the _Reference Sheet_ with the formulae in the _Template Sheet_. Formulae that are present in the _Reference Sheet_ but not in the _Template Sheet_ are identified as tasks to assess. This means that any formulae you put in the template for scaffolding purposes will not be assessed.

---

## 📤 Distributing Tasks to Your Students

Attach the _Slide Template_ to your Google Classroom assignment as normal.

---

## 🔍 Assessing Student Work

### ✅ Prerequisites

If you have followed the process above, you should have:

1. **A Slide Template**: The blank template for students to complete.
2. **Reference Slides**: A completed version of the _Slide Template_ that would score a `5` for completeness, accuracy, and SPaG.
3. **A Google Classroom Assignment**: The _Slide Template_ attached for students to complete.

> **Note:** Ensure students have completed at least part of the task before proceeding.

If you are missing any of these components, go back and complete them first.

### 🆔 Getting the Slide IDs

You need the _Reference Slides_ and _Slide Template_ IDs to assess the work. To get these:

1. Open each document.
2. Select the part of the URL after `/d/` and before `/edit`.
   - For example: `https://docs.google.com/presentation/d/THIS_BIT_IS_THE_SLIDE_ID/edit#slide=id.g2addc53a3a4_0_188`
3. Copy that part of the string.

> 💡 **Tip:** You only need to do this once for assignments with the same name. Encourage everyone in the department to name assignments consistently.
> ⚠️ **Note:** While this process is finicky, implementing a GUI method would require access to the `PickerAPI`, which is blocked for most educational accounts.

### ⚙️ The Assessment Process

1. Open the Assessment Bot web app.
2. Navigate to the **Classes** page and find the class you want to assess.
3. Click the **Assess Task** button on the class card.
4. Select the Google Classroom assignment you want to assess from the dropdown.
5. If no matching assignment definition exists, you will be prompted to either:
   - **Create a new definition** — this opens the definition wizard where you enter the _Reference Slides_ and _Slide Template_ IDs [which you obtained earlier](#-getting-the-slide-ids).
   - **Link to an existing definition** — choose a previously created definition from the list.
6. Click **Start Assessment**.
7. Wait patiently. The assessment can take 2 to 10 minutes depending on the document's size and complexity. Image tasks take significantly longer than text or table tasks.
8. Once complete, you can view the results in the **Assignments** page.
