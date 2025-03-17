FROM langflowai/langflow:latest

# Create a directory for flows in the container
RUN mkdir -p /app/flows

# Copy all JSON flow files from the local flows folder to the container
COPY ./flows*.json /app/flows/