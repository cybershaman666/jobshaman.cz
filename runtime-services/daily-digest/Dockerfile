FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /backend

COPY runtime-services/daily-digest/requirements.txt /backend/requirements.txt
RUN pip install --no-cache-dir -r /backend/requirements.txt

COPY backend /backend

CMD ["python3", "/backend/scripts/run_daily_digest.py"]
