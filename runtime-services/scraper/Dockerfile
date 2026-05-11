FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    JOBSHAMAN_SKIP_VENV_REEXEC=1

WORKDIR /backend

COPY backend/requirements.txt /backend/requirements.txt
RUN pip install --no-cache-dir -r /backend/requirements.txt

COPY backend /backend

CMD ["python3", "scripts/run_northflank_scraper_job.py"]
