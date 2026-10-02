FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    MEDIA_ROOT=/app/media

RUN useradd --create-home --uid 1000 app
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY --chown=app:app . .
RUN SECRET_KEY=collectstatic python manage.py collectstatic --noinput \
    && mkdir -p /app/media \
    && chown app /app/media
USER app

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=4)"
ENTRYPOINT ["./entrypoint.sh"]
# gthread workers: a voice request waits seconds for Gemini without blocking the others.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "4", \
     "--worker-class", "gthread", "--timeout", "120", "--forwarded-allow-ips", "*", "--access-logfile", "-"]
