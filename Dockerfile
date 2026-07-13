FROM node:22.22.2-alpine AS builder
WORKDIR /app
ARG PUBLIC_SITE_URL
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine@sha256:54f2a904c251d5a34adf545a72d32515a15e08418dae0266e23be2e18c66fefa
# frame-ancestors allowlist for the /embed endpoint (Tilda iframe). Substituted
# into nginx.conf.template at container start via the base image's envsubst step.
# Operator MUST append the published Tilda parent origin (custom domain) here.
ENV FRAME_ANCESTORS="'self' https://*.tilda.ws https://*.tilda.cc https://*.tilda.ru https://tilda.ws https://tilda.cc https://tilda.ru"
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --spider -q http://127.0.0.1/healthz || exit 1
