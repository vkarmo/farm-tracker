# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client

# Copy package descriptors and install dependencies
COPY client/package*.json ./
RUN npm ci --legacy-peer-deps

# Copy client source and build
COPY client/ ./
RUN npm run build

# Stage 2: Set up the production Express server
FROM node:20-alpine AS runner
WORKDIR /app

# Install server production dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy server code
COPY server/ ./server/

# Copy compiled frontend assets from Stage 1 into the location served by index.js
COPY --from=frontend-builder /app/client/dist ./client/dist

# Expose port (Cloud Run automatically sets the PORT env and expects us to listen on it)
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/server
CMD ["node", "index.js"]
