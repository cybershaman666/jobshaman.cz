<<<<<<< HEAD
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /backend

COPY runtime-services/daily-digest/requirements.txt /backend/requirements.txt
RUN pip install --no-cache-dir -r /backend/requirements.txt

COPY backend /backend

CMD ["python3", "/backend/scripts/run_daily_digest.py"]
=======
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /backend

COPY runtime-services/daily-digest/requirements.txt /backend/requirements.txt
RUN pip install --no-cache-dir -r /backend/requirements.txt

COPY backend /backend

CMD ["python3", "/backend/scripts/run_daily_digest.py"]
>>>>>>> 4c20d82 (Jobshaman MVP 2.0: Clean repo, i18n Nordic expansion & engine optimization)
