FROM node:26-trixie-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY ./src ./src

RUN npm run build

FROM node:26-trixie-slim

ARG TARGETARCH

ENV NODE_ENV=production

WORKDIR /app

COPY /configs /app/configs

#################
# Testing Tools #
#################

RUN apt-get update && apt-get install -y \
    sysstat \
    wget \
    iperf3 \
    nginx \
    && rm -rf /var/lib/apt/lists/*

RUN wget https://github.com/tsenart/vegeta/releases/download/v12.12.0/vegeta_12.12.0_linux_${TARGETARCH}.tar.gz
RUN tar -xvf vegeta_12.12.0_linux_${TARGETARCH}.tar.gz
RUN mv vegeta /usr/local/bin/
RUN rm vegeta_12.12.0_linux_${TARGETARCH}.tar.gz

RUN wget https://github.com/djxy/siffle/releases/download/1.0.0/siffle-linux-$(uname -m)
RUN mv siffle-linux-$(uname -m) /usr/local/bin/siffle
RUN chmod +x /usr/local/bin/siffle

#################
#    Tunnels    #
#################

RUN wget https://github.com/djxy/siffleux/releases/download/0.1.0/siffleux-linux-$(uname -m)
RUN mv siffleux-linux-$(uname -m) /usr/local/bin/siffleux
RUN chmod +x /usr/local/bin/siffleux

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# nginx
EXPOSE 80
# TCP/UDP echo
EXPOSE 3001
# iperf3
EXPOSE 5201
# siffle
EXPOSE 5678
# HTTP Tunnel Manager
EXPOSE 8080

ENTRYPOINT ["node", "dist/index.js"]
