FROM oven/bun:1 AS bun

FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock tsconfig.json tsconfig.base.json components.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json

RUN bun install --frozen-lockfile

COPY . .

EXPOSE 8787

CMD ["bun", "run", "docker:container"]
