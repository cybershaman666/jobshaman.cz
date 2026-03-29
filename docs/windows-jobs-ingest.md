# Windows jobs ingest

This project can run the full unified jobs ingest, including JobSpy, on Windows by using Docker instead of the local Python runtime.

## What this solves

- avoids the local `Python 3.14 + python-jobspy + numpy` incompatibility on Windows
- runs the full pipeline from `backend/scripts/run_unified_jobs_ingest.py`
- can be scheduled twice a day with Windows Task Scheduler

## Prerequisites

- Docker Desktop installed and running
- valid `backend/.env`
- the repository available locally

## One-off run

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run_jobs_ingest.ps1 -Rebuild
```

Next runs can skip image rebuild:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run_jobs_ingest.ps1
```

Logs are written to `logs/jobs-ingest/`.

## Install scheduled runs

This creates two daily tasks, morning and afternoon:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install_jobs_ingest_tasks.ps1 -MorningTime 06:00 -AfternoonTime 14:00
```

If you want the task to rebuild the Docker image before every run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install_jobs_ingest_tasks.ps1 -MorningTime 06:00 -AfternoonTime 14:00 -RebuildImage
```

## Run the scheduled task manually

```powershell
Start-ScheduledTask -TaskName "JobShaman Ingest Morning"
```

## Remove the scheduled tasks

```powershell
Unregister-ScheduledTask -TaskName "JobShaman Ingest Morning" -Confirm:$false
Unregister-ScheduledTask -TaskName "JobShaman Ingest Afternoon" -Confirm:$false
```
