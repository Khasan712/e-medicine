FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /bot

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

RUN useradd --system --no-create-home bot
USER bot

# SIGTERM stops polling at once and lets the updates being handled finish.
STOPSIGNAL SIGTERM
CMD ["python", "-m", "app"]
