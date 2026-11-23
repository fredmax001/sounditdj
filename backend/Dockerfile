FROM node:18-alpine

# Install build dependencies and FFmpeg
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-setuptools \
    make \
    g++ \
    gcc \
    libusb-dev \
    linux-headers \
    eudev-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with unsafe-perm for native modules
RUN npm install --omit=dev --unsafe-perm

# Copy source code
COPY . .

# Ensure directories exist
RUN mkdir -p database uploads processed covers temp logs

EXPOSE 3001

CMD ["node", "src/index.js"]
