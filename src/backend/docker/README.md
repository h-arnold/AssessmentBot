# Google Cloud Run and the need for a custom Dockerfile.

I run my instance of langflow in Google Cloud Run due to Langflow's need for a relatively beefy server (1 CPU and 1GB or RAM per worker) and it's relatively generous free-tier which works well for demanding, bursty applications like this which can then quickly scale to zero.

Unfortunately, Langflow needs a fully POSIX-compliant file system to run more than one worker which Google Cloud Run doesn't provide. Assessments will never finish within the 15 minute execution limit of Google App Script if requests are made one at a time and so some concurrency is required.

The `DockerFile` in this folder adds an extra layer to the `langflow-backend-nightly` image which creates a RAMDISK to hold the directories which need to be writeable. This allows me to run multiple single-worker instances of Langflow, however, you will need to connect those instances to a postgres instance that can cope with however many instances you create.

At some point I will build the flows into this Docker Image so that no external DB connection is needed, increasing privacy further.

## Deploying to Google Cloud Run

You can use the `configuration.yaml` file to build the Docker Image using Google Cloud Build and use that in Google Cloud run to deploy the backend. At some point I'll update the code to set up the whole deployment.