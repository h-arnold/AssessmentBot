# Setting up Assessment Bot

This guide walks you through setting up Assessment Bot, a tool that streamlines the assessment of student work in Google Slides.

- [Setting up Assessment Bot](#setting-up-assessment-bot)
  - [Prerequisites](#prerequisites)
  - [Core Components](#core-components)
    - [1. Assessment Bot LLM Service](#1-assessment-bot-llm-service)
    - [2. Assessment Records](#2-assessment-records)
  - [The Setup Process](#the-setup-process)
    - [Setting up the LLM Service](#setting-up-the-llm-service)
    - [Setting up the Assessment Bot web app](#setting-up-the-assessment-bot-web-app)
      - [1. Configuring Assessment Bot](#1-configuring-assessment-bot)
      - [2. Creating the Assessment Records](#2-creating-the-assessment-records)
      - [3. Getting started with your first assessment](#3-getting-started-with-your-first-assessment)
  - [Final Thoughts](#final-thoughts)

## Prerequisites

Before starting, ensure you have the following:

- **Mistral API access:** The LLM service uses Mistral's `mistral-small-latest` model.
  The [service repository](https://github.com/h-arnold/AssessmentBot-LLM-Service) documents
  the provider and data-retention details.
- **An Assessment Bot LLM Service API key:** You enter this key in Assessment Bot's backend
  settings. The service repository explains how to deploy the service and obtain a key.
- **A Google Workspace for Education account:** Ensure you have active Google Classrooms to pull your students' Google Slides documents from.

---

## Core Components

Understanding the system's components will help you see how it all fits together:

### 1. Assessment Bot LLM Service

The [Assessment Bot LLM Service](https://github.com/h-arnold/AssessmentBot-LLM-Service) provides the LLM (Large Language Model) service for handling assessments. It interprets and marks student submissions.

### 2. Assessment Records

Assessment data is stored in Drive-backed JsonDbApp collections, and you work with it through the Assessment Bot browser app.

---

## The Setup Process

Follow these steps to set up the system.

---

### Setting up the LLM Service

Deploy the LLM service using the
[deployment instructions](https://github.com/h-arnold/AssessmentBot-LLM-Service/blob/master/docs/deployment/docker.md)
in the Assessment Bot LLM Service repository.

---

### Setting up the Assessment Bot web app

This section is primarily for Heads of Department or administrators responsible for initial setup. Once configured, the system is straightforward for others to use.

#### [1. Configuring Assessment Bot](./configOptions.md)

- This step links the web app to the LLM Service so the system knows where to send and receive data during assessments. [Follow this guide](./configOptions.md) to configure it.

#### [2. Creating the Assessment Records](./settingUpAssessmentRecords.md)

- This step creates the class records that store assessment data.

#### [3. Getting started with your first assessment](../howTos/README.md)

- Once setup is complete, follow the [assessment guide](../howTos/README.md) to run your first assessment.

---

## Final Thoughts

- Always prioritise GDPR compliance when working with sensitive student data.
- Centralised updates and configurations reduce workload and ensure consistency across your organisation.
- Thoroughly test the system before introducing it into your live environment.

Once setup is complete, Assessment Bot is ready to assess your students' work.
