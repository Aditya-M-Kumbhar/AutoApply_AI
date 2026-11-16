FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=/api/v1
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000 \
    SERVE_FRONTEND=true \
    FRONTEND_DIST=/app/frontend/dist \
    UPLOAD_DIR=/data/resumes \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev \
    && ./node_modules/.bin/playwright install --with-deps chromium \
    && apt-get update && apt-get install -y --no-install-recommends gosu tini \
    && rm -rf /var/lib/apt/lists/* \
    && chmod -R a+rX /ms-playwright
COPY backend/src/ ./src/
COPY backend/scripts/ ./scripts/
COPY backend/evals/ ./evals/
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
COPY deploy/entrypoint.sh /usr/local/bin/autoapply-entrypoint
RUN chmod 755 /usr/local/bin/autoapply-entrypoint \
    && mkdir -p /app/backend/logs \
    && chown node:node /app/backend/logs
EXPOSE 10000
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/autoapply-entrypoint"]
CMD ["node", "src/server.js"]
