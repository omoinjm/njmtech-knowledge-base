FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install --no-cache-dir poetry

# Set the working directory in the container
WORKDIR /app

# Copy project files
COPY . /app/

# Make the entrypoint executable
RUN chmod +x /app/entrypoint.sh /app/scripts/run_cron.sh

# Install python dependencies
ENV POETRY_HTTP_TIMEOUT=300
RUN poetry config virtualenvs.create false && poetry install --without dev --no-interaction --no-ansi

ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["/app/entrypoint.sh"]
