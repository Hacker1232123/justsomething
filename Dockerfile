FROM node:20-alpine

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --no-frozen-lockfile --filter server...

COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

RUN pnpm --filter shared build && pnpm --filter server build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["pnpm", "--filter", "server", "start"]
