FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY tsconfig.json ./
COPY src/ ./src/
COPY frontend/ ./frontend/
COPY public/ ./public/

# Build server + client
RUN npm run build

# Expose port
EXPOSE 3000

# Run the service
CMD ["node", "dist/index.js"]
