# State Management: Blob Storage vs. Postgres

This document outlines the current logic for tracking file processing states and compares it with a potential database-driven approach (e.g., Postgres) for future scalability.

## Current Architecture: File-System-as-State

The application currently uses the presence or absence of files in Vercel Blob Storage to determine its processing state.

### How it works:
1. **Scan:** The `DirectoryScanner` lists all blobs in the `ROOT_SCAN_FOLDER`.
2. **Evaluate:** A directory is "pending" if it contains exactly one `.txt` file and **no** `.md` files.
3. **Process:** Once processed, a `.md` version of the file is uploaded to the same directory.
4. **Completion:** On the next scan, the scanner sees the `.md` file and skips the directory.

### Advantages:
- **Simplicity:** No database setup, migrations, or connection management.
- **Visual State:** Developers can see the "state" of the pipeline by browsing the storage container.
- **Portability:** The state is stored directly with the data it describes.

### Disadvantages:
- **Scan Overhead:** As the number of directories grows, `list()` operations become slower and more expensive (API limits).
- **Limited Metadata:** Cannot easily track "failed" states, retry counts, or processing duration without adding more "marker" files (e.g., `.error` files).
- **Concurrency Risks:** Hard to prevent multiple instances from picking up the same file simultaneously without a centralized locking mechanism.

---

## Alternative Architecture: Postgres-Based Tracking

In this model, a database table (e.g., `processing_jobs`) would act as the source of truth for the cron job.

### Proposed Schema:
- `id`: UUID (Primary Key)
- `file_path`: String (Unique)
- `status`: Enum (`pending`, `processing`, `completed`, `failed`)
- `last_error`: Text (Nullable)
- `retry_count`: Integer
- `created_at`: Timestamp
- `updated_at`: Timestamp

### Comparison Table:

| Feature | Blob-State (Current) | Postgres Table (Future) |
| :--- | :--- | :--- |
| **Setup Cost** | Zero | Infrastructure & Migration required |
| **Scaling** | Degrades with file count | High (efficient indexing) |
| **Error Handling** | Hard to track specific errors | Detailed logs per record |
| **Observability** | Manual folder inspection | SQL queries/Dashboards |
| **Locking** | Optimistic (risky) | Row-level locking (safe) |

## Recommendation for Migration
Stick with the **Blob-State** logic for small-to-medium volumes (< 1,000 directories). Consider migrating to **Postgres** if:
1. The cron execution time exceeds the interval (e.g., taking > 1 minute to scan).
2. You need complex retry logic for AI model failures.
3. You require audit logs of when/how each transcript was transformed.
