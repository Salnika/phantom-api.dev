# -------- STAGE 1 : Dépendances install (Yarn 4 PnP, sans node_modules) --------
FROM node:24-slim AS deps
WORKDIR /app

# Pré-requis build natifs
RUN corepack enable
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copie du coeur monorepo (racine)
COPY package.json yarn.lock .yarnrc.yml ./

# Copie les package.json de TOUS les workspaces déclarés (sinon Yarn bloque)
COPY phantom-api-backend/package.json ./phantom-api-backend/
COPY phantom-api/package.json ./phantom-api/
COPY admin-interface/package.json ./admin-interface/

# Install des deps monorepo en mode strict (pas de node_modules, que .pnp.cjs/.yarn/cache)
RUN yarn install

# -------- STAGE 2 : Build du workspace cible --------
FROM node:24-slim AS builder
WORKDIR /app

RUN corepack enable

# Copy infra Yarn 4 (fichiers de config PnP, etc)
COPY --from=deps /app/.pnp.cjs ./.pnp.cjs
COPY --from=deps /app/.pnp.loader.mjs ./.pnp.loader.mjs
COPY --from=deps /app/.yarn/ ./.yarn/
COPY --from=deps /app/yarn.lock ./yarn.lock
COPY --from=deps /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=deps /app/package.json ./package.json

# On copie tous les package.json workspaces (pour permettre build Yarn workspaces)
COPY --from=deps /app/phantom-api-backend/package.json ./phantom-api-backend/
COPY --from=deps /app/phantom-api/package.json ./phantom-api/
COPY --from=deps /app/admin-interface/package.json ./admin-interface/

# Copie le code source des workspaces à builder
COPY phantom-api-backend/ ./phantom-api-backend/
COPY admin-interface/ ./admin-interface/

# Build des projets nécessaires à l'image
# Utilise un chemin absolu pour le loader PnP, car les scripts workspace
# s'exécutent depuis le dossier du package (sinon ./ pointe vers le workspace)
ENV NODE_OPTIONS="--experimental-loader=/app/.pnp.loader.mjs"
RUN yarn workspace phantom-api-backend build \
 && yarn workspace admin-interface build

# -------- STAGE 3 : Runtime production allégé --------
FROM node:24-slim AS runner
WORKDIR /app

# Santé + sécurité + dépendances build
RUN apt-get update && apt-get upgrade -y && apt-get install -y curl python3 make g++ && rm -rf /var/lib/apt/lists/*

# User non-root (bonne pratique Docker prod)
RUN addgroup --system --gid 1001 phantom && \
    adduser --system --uid 1001 phantom

# Copie le strict minimum pour exécuter le backend + admin interface
COPY --from=builder --chown=phantom:phantom /app/phantom-api-backend/dist ./phantom-api-backend/dist
COPY --from=builder --chown=phantom:phantom /app/phantom-api-backend/package.json ./phantom-api-backend/package.json

# Copie l'admin interface buildée depuis l'étape builder
COPY --from=builder --chown=phantom:phantom /app/admin-interface/dist ./admin-interface/dist

# Copie infra Yarn PnP pour la résolution runtime
COPY --from=builder --chown=phantom:phantom /app/.pnp.cjs ./.pnp.cjs
COPY --from=builder --chown=phantom:phantom /app/.pnp.loader.mjs ./.pnp.loader.mjs
COPY --from=builder --chown=phantom:phantom /app/.yarn/ ./.yarn/
COPY --from=builder --chown=phantom:phantom /app/yarn.lock ./yarn.lock
COPY --from=builder --chown=phantom:phantom /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=builder --chown=phantom:phantom /app/package.json ./package.json

# Prépare dossiers data/logs pour persistance
RUN mkdir -p /app/data /app/logs && \
    chown -R phantom:phantom /app/data /app/logs

# Enable corepack for yarn support
RUN corepack enable

# Install production dependencies using yarn (en root pour éviter les problèmes de permissions)
WORKDIR /app
ENV NODE_OPTIONS="--experimental-loader=/app/.pnp.loader.mjs"
RUN yarn workspaces focus phantom-api-backend --production

# Change ownership après installation
RUN chown -R phantom:phantom /app

USER phantom
WORKDIR /app/phantom-api-backend
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENV NODE_OPTIONS="--experimental-loader=/app/.pnp.loader.mjs"
CMD ["node", "dist/index.js"]
