FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS prisma
COPY prisma ./prisma
RUN npx prisma generate

FROM prisma AS builder
ARG BASE_PATH=""
ENV BASE_PATH=$BASE_PATH
COPY . .
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY --from=prisma /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "scripts/bootstrap.mjs"]
