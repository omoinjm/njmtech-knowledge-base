FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install poetry

# Set the working directory in the container
WORKDIR /app

# Copy project files
COPY apps/blob-cron/ /app/

# Make the cron script executable
RUN chmod +x /app/scripts/run_cron.sh

# Install python dependencies
ENV POETRY_HTTP_TIMEOUT=300
RUN poetry config virtualenvs.create false && poetry install --without dev --no-interaction --no-ansi

# Copy crontab file
COPY apps/blob-cron/crontab /etc/cron.d/blob_cron

# Give execution rights to the cron job
RUN chmod 0644 /etc/cron.d/blob_cron

# Create the log file to be able to run tail
RUN touch /var/log/cron.log

# Run the command on container startup
# printenv dumps env vars to /etc/environment which cron reads
CMD printenv > /etc/environment && cron && tail -f /var/log/cron.log
