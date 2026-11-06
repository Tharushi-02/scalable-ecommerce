# ---------- Stage 1: install production libraries ----------
FROM node:24-alpine AS deps
WORKDIR /app

# Copy only the package files first, so this layer stays cached
# until your dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Stage 2: the final, small image ----------
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app

# The running server never needs npm/npx/yarn/corepack: remove them,
# so their own dependencies can't bring known vulnerabilities into production.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Don't run as root: if someone breaks in, they get a weak user.
USER node

EXPOSE 4000

# Docker checks this every 10s and marks the container healthy or unhealthy.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health > /dev/null || exit 1

CMD ["node", "src/server.js"]