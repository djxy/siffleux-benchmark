FROM node:26-bookworm AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY ./src ./src

RUN npm run build

FROM node:26-bookworm

ENV NODE_ENV=production

WORKDIR /app

RUN apt-get update && apt-get install -y \
    sockperf \
    iproute2 \
    iperf3 \
    nginx \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 80
EXPOSE 5201
EXPOSE 11111

ENTRYPOINT ["node", "dist/index.js"]
