FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
RUN npm install -g @bitwarden/cli
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY server.js start.sh ./
RUN chmod +x start.sh
EXPOSE 3000
CMD ["./start.sh"]
