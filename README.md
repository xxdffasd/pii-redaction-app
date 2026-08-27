## PII Redaction Engine

An enterprise-grade, asynchronous text anonymization service. It extracts and masks Personally Identifiable Information (PII) from bulk documents (`.txt`, `.pdf`, `.docx`, `.json`) using Microsoft Presidio, backed by a Celery distributed task queue.

### Architecture & Features

*   **Asynchronous Processing:** FastAPI instantly accepts batch uploads and offloads heavy NLP tasks to a Celery worker via an Upstash Redis message broker.
*   **Smart Polling UI:** The React frontend intelligently polls the backend for task completion to render real-time UI updates without blocking the browser thread.
*   **Self-Healing Storage:** A TTL (Time-To-Live) cleanup mechanism automatically purges generated files and ZIP archives from the server after 30 minutes to prevent storage leaks.

### Local Setup Instructions

1. **Clone & Configure:** Clone the repository and create a `.env` file in the `backend` directory containing your secure `REDIS_URL`.
2. **Backend Environment:** Navigate to the `backend` directory, create a Python virtual environment, and execute `pip install -r requirements.txt`.
3. **Boot FastAPI:** Run `uvicorn main:app --reload` to start the API server.
4. **Boot Celery Worker:** In a new, separate terminal window, start the background worker process using `celery -A app.worker.celery_app worker --loglevel=info -P eventlet` (the `-P eventlet` flag is mandatory for Windows environments).
5. **Frontend Environment:** Navigate to the `frontend` directory, execute `npm install`, and launch the Vite development server with `npm run dev`.

### API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/v1/redact/files` | Ingests a raw file batch and returns a polling `task_id`. |
| GET | `/api/v1/tasks/{task_id}` | Returns the execution status of the Celery worker queue. |
| GET | `/api/v1/download/{filename}` | Serves securely redacted files (returns a 410 Gone status after 30 minutes). |
