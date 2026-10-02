# The bot service. `make install` once, then `make test` (starts a throwaway PostgreSQL on localhost:55432).
.PHONY: install run test test-db stop-test-db

VENV ?= .venv
PYTHON ?= python3.12

install:
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install -r requirements-dev.txt

run:
	$(VENV)/bin/python -m app

test-db:
	@docker inspect dh-bot-test-db >/dev/null 2>&1 || docker run --rm -d --name dh-bot-test-db \
		-e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16
	@until docker exec dh-bot-test-db pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

test: test-db
	$(VENV)/bin/pytest -q

stop-test-db:
	docker stop dh-bot-test-db
