# syntax=docker/dockerfile:1.7
# ──────────────────────────────────────────────────────
#  gmc-skills-server: build + runtime image
# ──────────────────────────────────────────────────────

# ── Build stage ──
FROM node:22-alpine AS builder
WORKDIR /build

# Deterministic installs via lockfile
COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build \
  && npm prune --omit=dev


# ── Runtime stage ──
FROM node:22-alpine AS runtime

# git:            required by simple-git + `git archive` spawn
# ca-certificates: HTTPS clone
# tini:           proper PID 1 signal handling (SIGTERM forwards to node)
# openssh-client: optional, lets users switch to SSH remotes later
RUN apk add --no-cache git ca-certificates tini openssh-client \
  && addgroup -S gmc \
  && adduser -S -G gmc -h /home/gmc -s /sbin/nologin gmc \
  && mkdir -p /var/lib/gmc-skills \
  && chown -R gmc:gmc /var/lib/gmc-skills /home/gmc

WORKDIR /app

COPY --from=builder --chown=gmc:gmc /build/package.json ./package.json
COPY --from=builder --chown=gmc:gmc /build/node_modules ./node_modules
COPY --from=builder --chown=gmc:gmc /build/dist ./dist

USER gmc

ENV NODE_ENV=production \
    HOME=/home/gmc \
    PORT=8787 \
    GMC_SKILLS_STORAGE=/var/lib/gmc-skills/workdir \
    GMC_SKILLS_STATS_FILE=/var/lib/gmc-skills/stats.json

VOLUME ["/var/lib/gmc-skills"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT||8787,path:'/health'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
