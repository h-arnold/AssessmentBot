# 📚 Create Classroom Assessment Records

## 📄 Overview

This guide explains how to create Assessment Records using Assessment Bot. These records allow you to track the progress of all students in a selected class and form the core of the tool.

- [📚 Create Classroom Assessment Records](#-create-classroom-assessment-records)
  - [📄 Overview](#-overview)
  - [🚀 Quickstart](#-quickstart)
  - [📒 Creating the Assessment Records](#-creating-the-assessment-records)
    - [✅ Prerequisites](#-prerequisites)
    - [🪜 Steps to Follow](#-steps-to-follow)

---

## 🚀 Quickstart

To quickly test Assessment Bot using the frontend application:

1. Open the Assessment Bot frontend application.
2. Click **Settings** in the navigation sidebar.
3. Click the **Classes** tab (the default when opening Settings).
4. The class management panel lists available Google Classrooms and lets you create, manage, and configure class records.

---

## 📒 Creating the Assessment Records

### ✅ Prerequisites

- You have [configured Assessment Bot](./configOptions.md).
- You have at least one Google Classroom associated with the account running Assessment Bot.
- You have [deployed the Assessment Bot LLM Service](https://github.com/h-arnold/AssessmentBot-LLM-Service).

---

### 🪜 Steps to Follow

1. Open the Assessment Bot frontend application and click **Settings** in the navigation sidebar.

2. In the **Classes** tab you will see a table listing available Google Classrooms. Select the classes you want to set up as Assessment Records. Their current status (Created, Not Created) is shown for each row.

3. Use the **Create** button in the toolbar to bulk-create class records for the selected classrooms. A modal will prompt you to configure:
   - **Cohort** — The cohort group for the class.
   - **Year Group** — The year group key for the class.
   - **Course Length** — The duration of the course.

   A progress modal should appear as your records are created. Once complete, the table will update to show the new status.

4. After creation, you can set additional metadata for each class record:
   - Click **Set year group** to assign or change the year group key.
   - Use **Manage cohorts** or **Manage year groups** from the toolbar to create and edit reference data.

5. Navigate to the **Assignments** page in the sidebar and [start assessing!](../howTos/README.md)

---

💡 **Tip**: Make sure to thoroughly test each step in a safe environment before rolling out to a wider set of classrooms.
