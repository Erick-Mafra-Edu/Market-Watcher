FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

# Build TypeScript
RUN npm install -g typescript
RUN tsc

# Expose port
EXPOSE 3000

# Run the service
CMD ["node", "dist/index.js"]
