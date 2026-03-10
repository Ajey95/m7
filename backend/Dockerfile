# ============================================================
# Multi-stage Dockerfile — Food Rescue Platform (FastAPI)
# ============================================================
# Stage 1: builder  – install Python deps in a virtualenv
# Stage 2: runtime  – slim image with only what's needed
# ============================================================

# --------------- builder stage ---------------
FROM python:3.10-slim AS builder

# OS packages required to compile psycopg (libpq) and bcrypt (gcc)
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Create a virtualenv so we can copy it cleanly into the runtime stage
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# --------------- runtime stage ---------------
FROM python:3.10-slim AS runtime

# Runtime-only OS library for PostgreSQL client
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 && \
    rm -rf /var/lib/apt/lists/*

# Copy the pre-built virtualenv from the builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Non-root user for security
RUN groupadd --gid 1001 appuser && \
    useradd  --uid 1001 --gid appuser --create-home appuser

WORKDIR /app

# Copy application source code
COPY . .

# Create uploads directory (mounted as a volume in production)
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Health-check (requires curl – lightweight alternative is to use the
# built-in Python httpx; keep it simple here).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import httpx; r = httpx.get('http://localhost:8000/health'); r.raise_for_status()" || exit 1

# Production entrypoint — no --reload
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--log-level", "info"]
