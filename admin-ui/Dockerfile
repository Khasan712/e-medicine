# admin-ui — static build served by Caddy (SPA fallback, long-lived asset cache).
# The `web` container in front routes <slug>-admin.<domain> here and sends /api and /media to the backend.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM caddy:2.11-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
