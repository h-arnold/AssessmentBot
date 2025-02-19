# 🛠️ Setting up Google Slides Assessor

This guide will walk you through setting up the Google Slides Assessor, a tool designed to streamline the assessment of student work in Google Slides. 

- [🛠️ Setting up Google Slides Assessor](#️-setting-up-google-slides-assessor)
  - [📝 Prerequisites](#-prerequisites)
  - [🧩 Core Components](#-core-components)
    - [1️⃣ Langflow Backend](#1️⃣-langflow-backend)
    - [2️⃣ Google Slides Assessor Library](#2️⃣-google-slides-assessor-library)
    - [3️⃣ Assessment Records](#3️⃣-assessment-records)
    - [4️⃣ Overview Sheet](#4️⃣-overview-sheet)
  - [🚀 The Setup Process](#-the-setup-process)
    - [🌐 Setting up the Langflow Backend](#-setting-up-the-langflow-backend)
      - [⚡ The Easy Way (For Testing)](#-the-easy-way-for-testing)
      - [✅ The GDPR-Compliant Way (For Production)](#-the-gdpr-compliant-way-for-production)
    - [🖥️ Setting up the Google Apps Script Frontend](#️-setting-up-the-google-apps-script-frontend)
      - [1️⃣ Creating the Assessment Records](#1️⃣-creating-the-assessment-records)
      - [2️⃣ Configuring Google Slides Assessor](#2️⃣-configuring-google-slides-assessor)
      - [3️⃣ Setting up the Overview Sheet](#3️⃣-setting-up-the-overview-sheet)
      - [4️⃣ Getting started with your first assessment.](#4️⃣-getting-started-with-your-first-assessment)
  - [🌟 Final Thoughts](#-final-thoughts)

## 📝 Prerequisites

Before starting, ensure you have the following:

- **🔑 A Google Gemini API Key:** Respect your students' privacy by using the PAYG option, which does not use API responses to train future models.
- **🏫 A Google Workspace for Education Account:** Ensure you have active Google Classrooms to pull your students' Google Slides documents from.

---

## 🧩 Core Components

Understanding the system's components will help you see how it all fits together:

### 1️⃣ Langflow Backend

- Langflow ([GitHub Repo](https://github.com/langflow-ai/langflow)) provides the LLM (Large Language Model) backend for handling assessments. This allows for automated interpretation and marking of student submissions.

### 2️⃣ Admin Sheet

 - The Admin Sheet contains a bound script containing the frontend source code which is used as a library for the Assessment Records. It also allows you to:

  - Create and Manage Assessment Records for each class
  - Handle updates
  - Analyse whole-cohort data

### 3️⃣ Assessment Records

- A separate Google Sheet for each class, where assessment data is stored. This will be the tool most commonly used by your team.
---

## 🚀 The Setup Process

Follow these steps to set up the system.

---

### 🌐 Setting up the Langflow Backend

#### ⚡ The Easy Way (For Testing)

- Use the [Langflow Cloud Service](https://www.datastax.com/products/langflow) for quick setup.
- **Important:** This method is suitable for **testing only**, as it may not comply with GDPR or other privacy regulations. Use cautiously.

#### [✅ The GDPR-Compliant Way (For Production)](./langflowDeployment/langflowDeployment.md)

- Setting up Langflow on **Google Cloud Run** is highly recommended for production use. This approach provides the following benefits:

1. **💡 High Resource Requirements:** Langflow requires at least 1vCPU and 2GB of RAM per worker. Running it on a VPS can quickly become expensive.
2. **📈 Bursty Usage:** Langflow is rarely used continuously but must handle high demand during assessment periods. A serverless solution like Google Cloud Run scales up automatically when needed and scales back down to zero when idle, reducing costs.
3. **💰 Cost Efficiency:** For typical usage, the free tier of Google Cloud Run is sufficient, so you are unlikely to incur significant charges.
4. **📂 Ephemeral File Storage:** Following the guide will set up a shared `ramdisk` `.cache` folder. This ensures:
   - All uploaded images are available to all instances during an assessment.
   - Files are automatically deleted when the assessment run completes, as the instance shuts down.

- Follow [this guide](./langflowDeployment/langflowDeployment.md) to set up your own Google Cloud Run instance.

---

### 🖥️ Setting up the Google Apps Script Frontend

This section is primarily for Heads of Department or administrators responsible for initial setup. Once configured, the system is straightforward for others to use.

#### [1️⃣ Configuring Google Slides Assessor](./configOptions.md)

- This step links the frontend (Google Apps Script) to the backend (Langflow instance). It ensures the system knows where to send and receive data during assessments. [Follow this guide](./configOptions.md) to configure it.

#### [2️⃣ Creating the Assessment Records](./settingUpAssessmentRecords.md)

- Most assessment work takes place within these records, with one created per class. They serve as the main tool for day-to-day use. [Follow this guide](settingUpAssessmentRecords.md) to set them up with minimal fuss.


#### [4️⃣ Getting started with your first assessment.](/docs/howTos/README.md)

- All the hard work has been done. Now you need to get assessing! [Check out the documentation for that here.](/docs/howTos/README.md)

---

## 🌟 Final Thoughts

- 🔒 Always prioritise GDPR compliance when working with sensitive student data.
- 🛠️ Centralised updates and configurations reduce workload and ensure consistency across your organisation.
- 🚦 Thoroughly test the system before introducing it into your live environment.

Once everything is set up, your Google Slides Assessor will be ready to take on the hard work of assessing, leaving you free to focus on more important tasks. 🎉