FROM node:22-bookworm-slim AS base
WORKDIR /app

# Install dependencies only (prod)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Environment
ENV NODE_ENV=production \
    PORT=4000

# Ensure data directory exists for SQLite volume
RUN mkdir -p /app/data

EXPOSE 4000

# Default command
CMD ["node", "src/server.js"]

