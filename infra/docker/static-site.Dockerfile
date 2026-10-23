# Builds one Astro app (--build-arg PACKAGE=@acme/web, APP_DIR=apps/web) and serves it with an
# unprivileged nginx on port 8080.
FROM node:24.22-alpine AS build
ARG PACKAGE
ARG APP_DIR
ARG PUBLIC_API_URL=http://localhost:3000
ARG PUBLIC_NETWORK_URL=http://localhost:3001
ARG SITE_URL
# Demo fill buttons: off and empty unless compose passes them. They live in the build stage only
# (the nginx image gets the built files), and each app's astro:env schema reads just its own pair.
ARG PUBLIC_DEMO_MODE=false
ARG PUBLIC_DEMO_EMAIL=
ARG PUBLIC_DEMO_PASSWORD=
ARG PUBLIC_DEMO_ADMIN_EMAIL=
ARG PUBLIC_DEMO_ADMIN_PASSWORD=
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PUBLIC_API_URL=${PUBLIC_API_URL} \
    PUBLIC_NETWORK_URL=${PUBLIC_NETWORK_URL} \
    SITE_URL=${SITE_URL} \
    PUBLIC_DEMO_MODE=${PUBLIC_DEMO_MODE} \
    PUBLIC_DEMO_EMAIL=${PUBLIC_DEMO_EMAIL} \
    PUBLIC_DEMO_PASSWORD=${PUBLIC_DEMO_PASSWORD} \
    PUBLIC_DEMO_ADMIN_EMAIL=${PUBLIC_DEMO_ADMIN_EMAIL} \
    PUBLIC_DEMO_ADMIN_PASSWORD=${PUBLIC_DEMO_ADMIN_PASSWORD}
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter="${PACKAGE}"
RUN cp -r "${APP_DIR}/dist" /site

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
COPY infra/docker/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY infra/docker/nginx-static.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site /usr/share/nginx/html
EXPOSE 8080
