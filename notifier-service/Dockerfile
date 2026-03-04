FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm install -g typescript
RUN tsc

# Run the service
CMD ["node", "dist/index.js"]
