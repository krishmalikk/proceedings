# Next.js (standalone) image for Cloud Run — frontend `immiguide-web`.
# Built by `gcloud run deploy immiguide-web --source website`.

# ---- deps ----
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:20-slim AS build
WORKDIR /app
# Bake the backend origin so build-time prerender of ISR routes (e.g. /api/users)
# fetches the real backend and caches the correct response. Runtime --set-env-vars
# also provides it. Bare origin, NO trailing /api (apiBase() also normalizes it).
ENV PYTHON_API_URL=https://immiguide-api-971592620882.us-central1.run.app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- run ----
FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV PYTHON_API_URL=https://immiguide-api-971592620882.us-central1.run.app
# Standalone server bundle + static assets + public/ (favicon, og-image, logo).
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 8080
CMD ["node", "server.js"]
