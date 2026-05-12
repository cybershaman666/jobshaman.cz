FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /backend

COPY backend/requirements.txt /backend/backend-requirements.txt
COPY runtime-services/daily-digest/requirements.txt /backend/runtime-requirements.txt
RUN pip install --no-cache-dir -r /backend/backend-requirements.txt -r /backend/runtime-requirements.txt

COPY backend /backend

CMD ["python3", "/backend/scripts/run_daily_digest.py"]
