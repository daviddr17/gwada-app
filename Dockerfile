# Production-Image für Coolify / VPS (git-SHA als Tag, Monorepo apps/web).
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/pos-domain/package.json ./packages/pos-domain/
COPY packages/supabase/package.json ./packages/supabase/
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web ./apps/web
COPY packages ./packages

ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL=https://gwada.app
ARG NEXT_PUBLIC_SUPABASE_URL=https://gwada.app/sb
ARG NEXT_PUBLIC_SUPABASE_PROXY=true
ARG NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false
ARG NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo
ARG SUPABASE_UPSTREAM_URL=http://127.0.0.1:8001
ARG GWADA_BUILD_SHA=unknown

ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PROXY=$NEXT_PUBLIC_SUPABASE_PROXY
ENV NEXT_PUBLIC_GWADA_SUPABASE_ONLY=$NEXT_PUBLIC_GWADA_SUPABASE_ONLY
ENV NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=$NEXT_PUBLIC_GWADA_WORKSPACE_SLUG
ENV SUPABASE_UPSTREAM_URL=$SUPABASE_UPSTREAM_URL
ENV GWADA_BUILD_SHA=$GWADA_BUILD_SHA

WORKDIR /app/apps/web
RUN pnpm build

FROM base AS runner
WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

ARG GWADA_BUILD_SHA=unknown
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL=https://gwada.app
ARG NEXT_PUBLIC_SUPABASE_URL=https://gwada.app/sb
ARG NEXT_PUBLIC_SUPABASE_PROXY=true
ARG NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false
ARG NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo
ARG SUPABASE_UPSTREAM_URL=http://127.0.0.1:8001

ENV GWADA_BUILD_SHA=$GWADA_BUILD_SHA
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PROXY=$NEXT_PUBLIC_SUPABASE_PROXY
ENV NEXT_PUBLIC_GWADA_SUPABASE_ONLY=$NEXT_PUBLIC_GWADA_SUPABASE_ONLY
ENV NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=$NEXT_PUBLIC_GWADA_WORKSPACE_SLUG
ENV SUPABASE_UPSTREAM_URL=$SUPABASE_UPSTREAM_URL

COPY --from=build /app/apps/web/.next ./.next
COPY --from=build /app/apps/web/public ./public
COPY --from=build /app/apps/web/content ./content
COPY --from=build /app/apps/web/package.json ./package.json
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/web/node_modules ./node_modules
COPY --from=build /app/packages /app/packages

EXPOSE 3000
CMD ["pnpm", "start"]
