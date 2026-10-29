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

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Don't run as root: if someone breaks in, they get a weak user.
USER node

EXPOSE 4000

# Docker checks this every 10s and marks the container healthy or unhealthy.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health > /dev/null || exit 1

CMD ["node", "src/server.js"]