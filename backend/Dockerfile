FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache wget

COPY package*.json ./

RUN npm ci --only=production=false

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache dumb-init wget

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

USER appuser

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1