# Multi-stage build pour optimiser la taille
FROM node:18-alpine AS builder

# Installer les dépendances de build pour les modules natifs
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm install --only=production && npm cache clean --force

FROM node:18-alpine

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Installer openssh-client pour la gestion des clés SSH
RUN apk add --no-cache openssh-client

WORKDIR /app

# Copier les dépendances du builder
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Créer les répertoires de données
RUN mkdir -p /app/data/ssh_keys && \
    chown -R nodejs:nodejs /app/data

# Exposer le port
EXPOSE 3000

# Passer à l'utilisateur non-root
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]
