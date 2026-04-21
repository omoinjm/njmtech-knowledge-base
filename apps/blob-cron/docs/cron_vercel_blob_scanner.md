# Cron-based Vercel Blob Scanner

This document describes how to design and build an application that runs a **cron job every minute**. The cron job executes a **Python program** that scans **Vercel Blob Storage** and applies conditional logic to files found under a specific directory.

---

## 1. High-Level Overview

The application consists of the following components:

- **Scheduler (cron)** – Triggers execution every minute
- **Python runtime** – Executes the scanning logic
- **Vercel Blob SDK / API** – Lists directories and files
- **Business logic** – Determines which directories qualify for further processing

At a high level, the cron job:

1. Runs every minute
2. Executes a Python script
3. Scans Vercel Blob starting from a root folder: `njmtech-blob-api`
4. Identifies subdirectories containing `.txt` files
5. Applies rules to determine whether to process or skip each directory

---

## 2. Cron Job Requirements

### 2.1 Execution Frequency

- The cron job must run **once every minute**.
- Cron expression:

```bash
* * * * *
```

### 2.2 Environment Options

The cron job can be hosted in one of the following environments:

- Linux server (system cron)
- Docker container
- Serverless cron provider (e.g. GitHub Actions, Vercel Cron, external schedulers)

> The environment must have access to:
>
> - Python 3.9+
> - Network access to Vercel Blob
> - Required environment variables

---

## 3. Python Application Overview

The Python application is responsible for all scanning and decision-making logic.

### 3.1 Responsibilities

The script must:

- Connect to Vercel Blob storage
- Start scanning from the folder:

```text
njmtech-blob-api/
```

- Recursively inspect all subdirectories
- Detect the presence of `.txt` files
- Evaluate directory contents based on file rules

---

## 4. Directory Scanning Logic

### 4.1 Root Folder

All scanning begins at:

```text
njmtech-blob-api
```

Only files and directories under this path are considered.

---

### 4.2 Identifying Candidate Directories

A directory qualifies as a **candidate** if:

- It contains **at least one `.txt` file**

The script must keep track of:

- Directory path
- List of files within that directory

---

## 5. File Evaluation Rules

Once a directory containing a `.txt` file is found, apply the following checks.

### 5.1 File Count Check

For the current directory:

- Count the total number of files
- Identify file extensions

---

### 5.2 Conditional Logic

| Condition                                       | Action                 |
| ----------------------------------------------- | ---------------------- |
| Only **one file exists** AND the file is `.txt` | Perform **(do stuff)** |
| More than one file exists                       | Skip directory         |
| `.md` file exists in the directory              | Skip directory         |

> **Important:**
> The presence of a `.md` file automatically disqualifies the directory, regardless of other files.

---

## 6. (do stuff) Placeholder

The action `(do stuff)` will be defined later.

This section is intentionally left as a placeholder and should be expanded once the behavior is known.

```text
TODO: Define processing logic for single .txt file directories
```

---

## 7. Error Handling & Edge Cases

The application should gracefully handle:

- Empty directories
- Network failures
- Missing permissions
- Unexpected file types
- Large directory trees

Recommended practices:

- Log all skipped directories with reasons
- Catch and log exceptions per directory
- Avoid failing the entire run due to a single error

---

## 8. Logging & Observability

Each cron execution should log:

- Start timestamp
- Number of directories scanned
- Number of directories skipped
- Number of directories processed
- Errors encountered

Logs should be structured and timestamped for easy debugging.

---

## 9. Future Enhancements

Potential future improvements:

- Parallel directory scanning
- Configurable root directory
- Dry-run mode
- Retry logic for transient failures
- Metrics export (Prometheus, OpenTelemetry)

---

## 10. Summary

This application provides a deterministic, cron-driven mechanism for scanning Vercel Blob storage and conditionally processing directories based on file composition. The architecture is intentionally modular so that additional processing logic can be added without modifying the scheduling or scanning foundation.
