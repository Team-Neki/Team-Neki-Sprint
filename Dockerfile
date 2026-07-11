# syntax=docker/dockerfile:1

# ---------- deps: install node_modules (postinstall runs prisma generate) ----------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---------- builder: compile the Next.js standalone bundle ----------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholder envs so `next build` can import modules that read process.env.
# Real values are injected at runtime from the k8s Secret/ConfigMap.
ENV AUTH_SECRET=build-placeholder
ENV AUTH_TRUST_HOST=true
ENV GOOGLE_CLIENT_ID=build
ENV GOOGLE_CLIENT_SECRET=build
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx prisma generate && npm run build

# ---------- runner: minimal runtime image ----------
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma schema, migrations, client + engines (needed at runtime and for migrate deploy).
# Copy the FULL builder node_modules rather than cherry-picking @prisma/prisma dirs:
# the migrate Job runs `prisma migrate deploy`, and Prisma 6.x's CLI loads @prisma/config
# which requires hoisted sibling deps (effect, c12, ...) that live at node_modules root,
# not under node_modules/@prisma. Cherry-picking dropped them -> "Cannot find module 'effect'".
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000

# Default: run the app. Pending Prisma migrations are applied by the deployment's
# initContainer (see the gitops repo overlays/prod/sprint-deployment.yaml).
CMD ["node", "server.js"]
