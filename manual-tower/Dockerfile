# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Install server dependencies (better-sqlite3 needs build tools)
FROM node:20-alpine AS server-build
RUN apk add --no-cache python3 make g++
WORKDIR /server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Stage 3: Production — nginx + Node API
FROM node:20-alpine
RUN apk add --no-cache nginx docker-cli

# nginx config — http.d is inside http{} block on Alpine; conf.d is top-level (no server{} allowed)
RUN rm -f /etc/nginx/http.d/default.conf /etc/nginx/conf.d/default.conf 2>/dev/null; \
    mkdir -p /etc/nginx/http.d
COPY nginx.conf /etc/nginx/http.d/default.conf

# Frontend static files
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Server
WORKDIR /server
COPY --from=server-build /server/node_modules ./node_modules
COPY server/ .

# Data directory for SQLite
RUN mkdir -p /data
ENV DATABASE_PATH=/data/wordtower.db

# Entrypoint: run nginx in background, then Node API in foreground
RUN printf '#!/bin/sh\nnginx\nexec node --import tsx index.ts\n' > /start.sh && chmod +x /start.sh

EXPOSE 80
CMD ["/start.sh"]
