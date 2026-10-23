# Builds one NestJS service of the monorepo: --build-arg PACKAGE=@acme/api (or @acme/card-network).
FROM node:24.22-alpine AS build
ARG PACKAGE
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter="${PACKAGE}"
RUN pnpm --filter="${PACKAGE}" deploy --prod --legacy /out

FROM node:24.22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" >/dev/null || exit 1
CMD ["node", "dist/main.js"]
