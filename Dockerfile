FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy lockfile and package.json first for better caching
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# Copy everything else
COPY . .

# Build TypeScript
RUN pnpm build

EXPOSE 5000
CMD ["pnpm", "start"]