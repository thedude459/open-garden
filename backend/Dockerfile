FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1 \
	PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt ./
RUN python -m venv /opt/venv \
	&& /opt/venv/bin/pip install --upgrade pip \
	&& grep -vE '^\s*pytest(==|>=|<=|~=|>|<)?' requirements.txt > /tmp/requirements-prod.txt \
	&& /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements-prod.txt

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1 \
	PATH="/opt/venv/bin:$PATH" \
	PORT=8000 \
	WEB_CONCURRENCY=2

WORKDIR /app

RUN groupadd --system appuser \
	&& useradd --system --gid appuser --create-home appuser

COPY --from=builder /opt/venv /opt/venv
COPY --chown=appuser:appuser alembic.ini ./
COPY --chown=appuser:appuser alembic ./alembic
COPY --chown=appuser:appuser app ./app

RUN mkdir -p /app/uploads && chown -R appuser:appuser /app/uploads

USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD python -c "import sys, urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3); sys.exit(0)"
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY}"]
