# Stage 1: Builder
FROM python:3.12-slim AS builder

WORKDIR /build

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip wheel --no-cache-dir --no-deps --wheel-dir /build/wheels -r requirements.txt

# Stage 2: Production Runner
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_URL="sqlite:////app/data/sales_support.db"

# Create non-root user for container security (IaC & DevSecOps best practice)
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser && \
    mkdir -p /app/data /app/uploads && chown -R appuser:appgroup /app

COPY --from=builder /build/wheels /wheels
COPY --from=builder /build/requirements.txt .
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

COPY --chown=appuser:appgroup ./app ./app
COPY --chown=appuser:appgroup ./tests ./tests

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
