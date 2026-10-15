# syntax=docker/dockerfile:1.7
FROM node:25-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:25-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=384 \
    MNOGOREELS_TRANSPORT=stdio \
    MNOGOREELS_HOST=0.0.0.0 \
    MNOGOREELS_PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 8080
LABEL io.modelcontextprotocol.server.name="ru.mnogo-reels/mnogoreels" \
      org.opencontainers.image.title="mnogoreels-mcp" \
      org.opencontainers.image.description="MCP server for MnogoReels: long videos to captioned vertical shorts, transcripts and articles" \
      org.opencontainers.image.source="https://github.com/RealSatanyan/mnogoreels-mcp" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="MnogoReels"
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "if(process.env.MNOGOREELS_TRANSPORT!=='http')process.exit(0);fetch('http://127.0.0.1:'+(process.env.MNOGOREELS_PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
ENTRYPOINT ["node", "dist/cli.js"]
