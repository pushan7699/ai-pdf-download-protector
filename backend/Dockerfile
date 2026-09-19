FROM node:20-alpine

# Install build deps needed by bcrypt and sharp
RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Create storage directories
RUN mkdir -p storage/private logs

EXPOSE 5000

CMD ["node", "src/server.js"]
