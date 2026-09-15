# Install dependencies only when needed
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/media/package.json ./apps/media/
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM node:20-bookworm-slim AS builder
WORKDIR /app
# Copy the whole deps stage, not just the root node_modules: pnpm workspaces
# also link a package-local node_modules (e.g. apps/media/node_modules/.bin/next)
# which is what actually resolves the `next` binary at build time.
COPY --from=deps /app ./
COPY . .

# Install pnpm again for the builder stage
RUN npm install -g pnpm

# Build with the app's own next build script, not the Nx executor: Nx 22.6.5's
# @nx/next build executor pulls in Next.js 16 as an internal peer, which
# conflicts with this app's pinned Next 15 and corrupts the Turbopack build.
RUN pnpm --filter njmtech-media run build

# Production image, copy all the files and run next
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/media/public ./apps/media/public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/apps/media/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/media/.next/static ./apps/media/.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "apps/media/server.js"]
