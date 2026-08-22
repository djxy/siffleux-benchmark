FROM node:26-trixie-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY ./src ./src

RUN npm run build

FROM node:26-trixie

ARG TARGETARCH

ENV NODE_ENV=production

WORKDIR /app

#################
# Testing Tools #
#################

RUN apt-get update && apt-get install -y \
    sysstat \
    wget \
    iperf3 \
    nginx \
    unzip \
    && rm -rf /var/lib/apt/lists/*

RUN wget https://github.com/tsenart/vegeta/releases/download/v12.12.0/vegeta_12.12.0_linux_${TARGETARCH}.tar.gz
RUN tar -xvf vegeta_12.12.0_linux_${TARGETARCH}.tar.gz
RUN mv vegeta /usr/local/bin/
RUN rm vegeta_12.12.0_linux_${TARGETARCH}.tar.gz

RUN wget https://github.com/djxy/siffle/releases/download/1.1.0/siffle-linux-$(uname -m)
RUN mv siffle-linux-$(uname -m) /usr/local/bin/siffle
RUN chmod +x /usr/local/bin/siffle

#################
#    Tunnels    #
#################

RUN wget https://github.com/djxy/siffleux/releases/download/0.3.1/siffleux-linux-$(uname -m)
RUN mv siffleux-linux-$(uname -m) /usr/local/bin/siffleux
RUN chmod +x /usr/local/bin/siffleux

RUN case "${TARGETARCH}" in \
        "amd64") RATHOLE_ARCH="x86_64-unknown-linux-musl" ;; \
        "arm64") RATHOLE_ARCH="aarch64-unknown-linux-musl" ;; \
        "arm")   RATHOLE_ARCH="armv7-unknown-linux-musleabihf" ;; \
        *) echo "Unsupported architecture: ${TARGETARCH}" && exit 1 ;; \
    esac && \
    wget "https://github.com/rathole-org/rathole/releases/download/v0.5.0/rathole-${RATHOLE_ARCH}.zip" && \
    unzip "rathole-${RATHOLE_ARCH}.zip" && \
    mv rathole /usr/local/bin/rathole && \
    chmod +x /usr/local/bin/rathole && \
    rm "rathole-${RATHOLE_ARCH}.zip"

RUN wget https://github.com/fatedier/frp/releases/download/v0.70.1/frp_0.70.1_linux_${TARGETARCH}.tar.gz
RUN tar -xf frp_0.70.1_linux_${TARGETARCH}.tar.gz
RUN mv frp_0.70.1_linux_${TARGETARCH}/frpc /usr/local/bin/frpc
RUN mv frp_0.70.1_linux_${TARGETARCH}/frps /usr/local/bin/frps
RUN chmod +x /usr/local/bin/frpc
RUN chmod +x /usr/local/bin/frps

COPY /configs /app/configs

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
