# Production image: build the SvelteKit SPA and run the Hono server on Bun.
# One service serves both the static UI and /api on $PORT.
FROM oven/bun:1 AS build
WORKDIR /app

# Install dependencies first (cached unless manifests change).
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
RUN bun install --frozen-lockfile

# Copy the rest of the source.
COPY . .

# Vite inlines VITE_* at build time, so they must be present for the web build.
ARG VITE_LFM_KEY
ARG VITE_LFM_CALLBACK
ENV VITE_LFM_KEY=$VITE_LFM_KEY
ENV VITE_LFM_CALLBACK=$VITE_LFM_CALLBACK
RUN bun run build:web

# --- runtime image ---
FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Bring over installed deps, the built SPA, and the server source.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/web/build ./apps/web/build
COPY --from=build /app/apps/server ./apps/server

# Railway injects PORT; the server binds it (falls back to 8787 locally).
EXPOSE 8787
CMD ["bun", "run", "apps/server/src/index.ts"]
