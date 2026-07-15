# 🛠️ Setting up Assessment Bot

This guide will walk you through setting up the Google Slides Assessor, a tool designed to streamline the assessment of student work in Google Slides.

- [🛠️ Setting up Assessment Bot](#️-setting-up-assessment-bot)
  - [📝 Prerequisites](#-prerequisites)
  - [🧩 Core Components](#-core-components)
    - [1️⃣ Assessment Bot LLM Service](#1️⃣-assessment-bot-llm-service)
    - [2️⃣ Assessment Records](#2️⃣-assessment-records)
  - [🚀 The Setup Process](#-the-setup-process)
    - [🌐 Setting up the LLM Service](#-setting-up-the-llm-service)
    - [🖥️ Setting up the Google Apps Script Frontend](#️-setting-up-the-google-apps-script-frontend)
      - [1️⃣ Configuring Assessment Bot](#1️⃣-configuring-assessment-bot)
      - [2️⃣ Creating the Assessment Records](#2️⃣-creating-the-assessment-records)
      - [3️⃣ Getting started with your first assessment.](#3️⃣-getting-started-with-your-first-assessment)
  - [🌟 Final Thoughts](#-final-thoughts)

## 📝 Prerequisites

Before starting, ensure you have the following:

- **🔑 A Google Gemini API Key:** Respect your students' privacy by using the PAYG option, which does not use API responses to train future models.
- **🏫 A Google Workspace for Education Account:** Ensure you have active Google Classrooms to pull your students' Google Slides documents from.

---

## 🧩 Core Components

Understanding the system's components will help you see how it all fits together:

### 1️⃣ Assessment Bot LLM Service

- ([The Assessment Bot LLM Service](https://github.com/h-arnold/AssessmentBot-LLM-Service)) provides the LLM (Large Language Model) service for handling assessments. This allows for automated interpretation and marking of student submissions.

### 2️⃣ Assessment Records

- A separate Google Sheet for each class, where assessment data is stored. This will be the tool most commonly used by your team.

---

## 🚀 The Setup Process

Follow these steps to set up the system.

---

### 🌐 Setting up the LLM Service

The LLM Service has an Alpine Linux based Docker image that can be deployed to a cloud provider of your choice. Check out the deloyment instructions here: [Assessment Bot LLM Service Deployment Instructions](https://github.com/h-arnold/AssessmentBot-LLM-Service/blob/master/docs/deployment/docker.md)

---

### 🖥️ Setting up the Google Apps Script Frontend

This section is primarily for Heads of Department or administrators responsible for initial setup. Once configured, the system is straightforward for others to use.

#### [1️⃣ Configuring Assessment Bot](./configOptions.md)

- This step links the frontend (Google Apps Script) to the LLM Service. It ensures the system knows where to send and receive data during assessments. [Follow this guide](./configOptions.md) to configure it.

#### [2️⃣ Creating the Assessment Records](./settingUpAssessmentRecords.md)

- This step creates the class records that store assessment data.

#### [3️⃣ Getting started with your first assessment.](../howTos/README.md)

- All the hard work has been done. Now you need to get assessing! [Check out the documentation for that here.](../howTos/README.md)

---

## 🌟 Final Thoughts

- 🔒 Always prioritise GDPR compliance when working with sensitive student data.
- 🛠️ Centralised updates and configurations reduce workload and ensure consistency across your organisation.
- 🚦 Thoroughly test the system before introducing it into your live environment.

Once everything is set up, your Google Slides Assessor will be ready to take on the hard work of assessing, leaving you free to focus on more important tasks. 🎉
