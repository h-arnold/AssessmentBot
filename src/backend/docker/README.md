# Google Cloud Run and the need for a custom Dockerfile.

I run my instance of langflow in Google Cloud Run due to Langflow's need for a relatively beefy server (1 CPU and 1GB or RAM per worker) and it's relatively generous free-tier which works well for demanding, bursty applications like this which can then quickly scale to zero.

Unfortunately the Cloud Run 'In-Memory Filesystem' (IFS) which I use to ensure that images of student work only last as long as the instance is running (max 20 minutes) doesn't play nicely with non-root users as that's not something that's currently supported.

As a result, I've created a custom Dockerfile which follows the same process as the [original langflow dockerfile](https://github.com/langflow-ai/langflow/blob/main/docker/build_and_push.Dockerfile) except for these differences:

 - The stable version tarball is pulled from Github (v1.2.0 at the time of writing) rather than working directly from the cloned repo.
 - Any steps to create or run the code as a non-root user have been removed.
