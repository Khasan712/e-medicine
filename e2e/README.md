# DeliveryHub end-to-end tests

Playwright tests of the whole platform running in Docker: our panel opens a business, its owner fills the
catalog, a customer orders in the shop, the owner completes the order and the customer sees it.

```bash
docker compose up -d --build   # from the repository root; the stack needs SHOP_OTP_DEBUG=True (the shop shows
                               # the sign-in code) — a local stack only
make e2e                       # npm ci, playwright test, then deletes the e2e-* businesses
```

* A platform staff account is needed: `E2E_PLATFORM_PHONE` / `E2E_PLATFORM_PASSWORD`, or the local
  `../.dev-accounts.txt` (`platform …: phone=… password=…`).
* `E2E_PORT` — the port of the `web` container (default 8100). Hosts: `hub.localhost`, `<slug>.localhost`,
  `<slug>-admin.localhost`.
* Every run opens a business `e2e-<stamp>`; `manage.py delete_business --prefix e2e- --yes` removes them.
* Failures keep a screenshot and a trace in `results/` (`npx playwright show-trace results/…/trace.zip`).
