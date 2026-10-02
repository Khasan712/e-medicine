"""The platform (public PostgreSQL schema): businesses, their domains and Telegram bots, and our own panel.

Every business has its own schema with the regular apps (`app`, `adminbot`): products, orders, customers,
staff. django-tenants picks the schema from the request host (hub.middleware) and bots switch to it with
`tenant_context` (hub.runtime).
"""
