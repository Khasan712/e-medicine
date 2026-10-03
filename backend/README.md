# DeliveryHub backend

Django 5.2 + Django REST framework + django-tenants. One service serves three APIs — the host of the request picks
the business (its PostgreSQL schema) and the API ([docs/api.md](../docs/api.md)):

| Host | API | URLs |
|---|---|---|
| `<slug>.<domain>` | Shop (customers, bearer token) | `config/urls/shop.py` → `api/shop/` |
| `<slug>-admin.<domain>` | Admin panel (staff, session + CSRF) | `config/urls/admin.py` → `api/admin/` |
| `deliveryhub.<domain>`, `hub.localhost` | Platform (our staff, session + CSRF) | `config/urls/platform.py` → `api/platform/` |

```
backend/
├── config/             settings, the URL configuration of each API, wsgi
├── api/                HTTP layer: views, serializers, URLs of each API
│   ├── common/         errors, pagination, permissions, session sign-in, rate limits, Telegram initData
│   ├── shop/  admin/  platform/
├── apps/               domain layer (models, services, migrations)
│   ├── core/           business data — staff users, catalog, customers, orders   (label "app", every schema)
│   ├── platform/       businesses, domains, bots, provisioning, host middleware  (label "hub", public schema)
│   ├── telegram/       staff links, invites, order cards, outbox for the bot service (label "adminbot")
│   └── voice/          Gemini voice/text order understanding
├── tests/              pytest
└── scripts/            demo catalog
```

The app labels (`app`, `hub`, `adminbot`) keep the table names and the migration history of the existing database.
The bot service (`../bot`) reads and writes the same tables directly; schema changes are made here, by migrations.

## Run

With Docker (from the repository root): `docker compose up -d --build backend` — applies the migrations of every
business, creates the platform and our admin account (`PLATFORM_ADMIN_PHONE` / `PLATFORM_ADMIN_PASSWORD`) and starts
gunicorn on port 8000 (behind the `web` container).

On the host:

```bash
python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python manage.py migrate_schemas
.venv/bin/python manage.py ensure_platform
.venv/bin/python manage.py runserver 8000
```

Settings come from the environment / `../.env` (see `../.env.example`).

Useful commands:

| Command | What it does |
|---|---|
| `manage.py ensure_platform` | our panel + its domains, every business's domains for the current `PLATFORM_DOMAIN`, our admin account |
| `manage.py ensure_platform_admin` | creates / updates our admin account from the environment |
| `manage.py migrate_schemas` | migrations of the public schema and of every business |
| `manage.py delete_business <slug>… [--prefix e2e-] [--yes]` | deletes businesses for good: schema, domains, bots, files (our panel: `DELETE /api/v1/businesses/<slug>`) |
| `manage.py tenant_command shell --schema=<schema> < scripts/seed_data.py` | demo catalog for one business |
| `manage.py spectacular --urlconf config.urls.shop --file ../docs/openapi/shop.yaml` | OpenAPI file of one API |

## Tests

The tests need PostgreSQL (schemas). A throwaway one:

```bash
docker run --rm -d --name dh-backend-test-db -e POSTGRES_USER=deliveryhub -e POSTGRES_PASSWORD=test -e POSTGRES_DB=deliveryhub -p 55433:5432 postgres:16
.venv/bin/pytest
.venv/bin/flake8 api apps config tests scripts manage.py
```

`config/test_settings.py` points at it (override with `POSTGRES_*`) and keeps Telegram, Gemini and SMS out.
Tests run inside a test business (`apps.platform.testing.BusinessTestCase`): `self.client` talks to its admin API,
`self.shop` to its shop API, `self.platform_client()` to the platform API.
