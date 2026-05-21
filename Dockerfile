FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY package.json package-lock.json* ./
RUN npm install
COPY --from=builder /app/dist ./dist
COPY server ./server
RUN mkdir -p data/reports uploads

EXPOSE 3000
ENV NODE_ENV=production
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "tsx", "server/index.ts"]
