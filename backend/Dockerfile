FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY src ./src

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "src/index.js"]
