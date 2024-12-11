# 🔧 Deploying Langflow Server

**IMPORTANT**: I highly recommend setting your region closest to where you work. This will minimise the chances of falling foul of privacy laws such as GDPR.

## ✨ Prerequisites

### ▪️ Google Cloud Project
- Ensure you have an active Google Cloud project with billing enabled.

### ▪️ Google Cloud CLI
- Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) and authenticate:
  ```bash
  gcloud auth login
  gcloud config set project [PROJECT_ID]
  ```

### ▪️ Enable Required APIs
- Enable the following APIs:
  ```bash
  gcloud services enable run.googleapis.com container.googleapis.com secretmanager.googleapis.com
  ```

### ▪️ PostgreSQL Database
- A PostgreSQL database is required for this deployment. [Supabase](https://supabase.com/) offers free PostgreSQL databases with GDPR-compliant data centres in Europe, making it a suitable choice. 

 **💡 Tip:** Use the `Transaction Pooler` option for connecting to your database. Using direct connections will cause you lots of issues if you go over 2 concurrent connections with Langflow.

### ▪️ Setup Necessary Resources

#### 🔑 Service Account
- Ensure the service account `<SERVICE_ACCOUNT_NAME>` exists and has the following permissions:
  - Cloud Run Invoker
  - Secret Manager Secret Accessor
  - Storage Object Viewer (if accessing GCS bucket)

#### 🔐 Secrets
- Create the secrets referenced in the YAML file:
  ```bash
  gcloud secrets create <SUPERUSER_PASSWORD_SECRET> --replication-policy="automatic"
  gcloud secrets create <DATABASE_URL_SECRET> --replication-policy="automatic"
  gcloud secrets create <POSTGRES_CERT_SECRET> --replication-policy="automatic"
  ```

- Store the required values in these secrets:
  ```bash
  echo -n "<SUPERUSER_PASSWORD>" | gcloud secrets versions add <SUPERUSER_PASSWORD_SECRET> --data-file=-
  echo -n "<DATABASE_URL>" | gcloud secrets versions add <DATABASE_URL_SECRET> --data-file=-
  echo -n "<CERT_CONTENT>" | gcloud secrets versions add <POSTGRES_CERT_SECRET> --data-file=-
  ```

## 🔄 Deployment Steps

### ▪️ Prepare the YAML File
- Get a copy of [this yaml file](./service.yaml).
- Replace placeholders (`<SERVICE_NAME>`, `<REGION>`, etc.) with actual values. Ensure the YAML file is saved locally as `service.yaml`.

### ▪️ Deploy the Service
- Run the following command to deploy the service:
  ```bash
  gcloud run services replace service.yaml
  ```

  This command will create or update the service based on the YAML configuration.

### ▪️ Verify the Deployment
- Check the status of the service:
  ```bash
  gcloud run services describe <SERVICE_NAME> --region=<REGION>
  ```
- Note the generated URL to access the service.

---

## 📊 Post-Deployment Tasks

### ▪️ Test the Service
- Access the service using the provided URL and verify functionality.

### ▪️ Monitor and Debug
- Monitor logs to ensure the service is running as expected:
  ```bash
  gcloud logs read --service=<SERVICE_NAME> --region=<REGION>
  ```

### ▪️ Scaling and Autoscaling
- The configuration allows up to 5 instances with 20 concurrent requests per instance. Adjust `autoscaling.knative.dev/maxScale` or `containerConcurrency` if needed.

### ▪️ Secure Access (Optional)
- Restrict access to authorised users or services by configuring IAM roles and policies:
  ```bash
  gcloud run services add-iam-policy-binding <SERVICE_NAME> \
    --region=<REGION> \
    --member="user:<EMAIL>" \
    --role="roles/run.invoker"
  ```

---

## 🖊 Notes

### ▪️ Execution Environment
- The service is configured for `gen2`. Verify compatibility with your application requirements.

### ▪️ Secrets Handling
- Secrets are securely accessed using Secret Manager. Avoid embedding sensitive information directly in the YAML file.

### ▪️ Volume Mounts
- Ensure the bucket and `emptyDir` configurations meet your performance and security needs.