# Siffleux Benchmark
This benchmark is used to test different tunnels and monitor their resources usage. I did this to create external tests to [Siffleux](https://github.com/djxy/siffleux) and then I extended it to other tunnels to compare them.

## Tunnels Tested

- [Frp](https://github.com/fatedier/frp)
- [Rathole](https://github.com/rathole-org/rathole)
- [Siffleux](https://github.com/djxy/siffleux)

## How It Works

The benchmark is done with 4 containers.

1. **Test Server**: The test server starts all the server side of the tools used to test. It starts Nginx, a Iperf3 server, a Siffle server and a TCP/UDP echo server.
2. **Tunnel Client**: The tunnel client starts and stops the tunnel clients(Frp, Rathole, Siffleux). Once it start a client, it will monitor the resources usage until it stops it.
3. **Tunnel Server**: The tunnel server starts and stops the tunnel servers(Frp, Rathole, Siffleux). Once it start a server, it will monitor the resources usage until it stops it.
4. **Test Client**: The test client execute the tests against the tunnel server. It tests the tunnel with Vegeta, Iperf3, Siffle and NodeJS.

## Installation
Everything is done with docker and docker compose. You have to build the docker image locally and then run docker compose. It will start the **Test Server**, **Tunnel Client** and **Tunnel Server** containers. The **Test Client** container is run manually with the commands from the [tests](#tests).

```bash
docker build -t siffleux-benchmark .

docker compose up -d
```

# Tests

The tests target the protocol layers 4 and 7. TCP and UDP have all the same tests to test latency, bandwidth, conccurent connections open and opening/closing many connections per second. HTTP 

## TCP Tests

### Latency
Starts [Siffle](https://github.com/djxy/siffle) to test latency over UDP.

```bash
docker run --rm -it --network siffleux-benchmark_default siffleux-benchmark tcp latency --tunnel siffleux
```

### Bandwidth
Start [Iperf3](https://github.com/esnet/iperf) to test TCP bandwidth and starts [Sockperf](https://github.com/mellanox/sockperf) and test latency with a TCP connection.

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_siffleux-net siffleux-benchmark:latest tcp bandwidth --ip 192.168.107.2 --sockperf-port 9000 --iperf3-port 9002 --duration 10
```

### Idle Connections
Create multiple TCP connections to the server and keep them idle for the duration of the test. To prevent timeouts, each connection sends 1 byte each few seconds. 

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_siffleux-net siffleux-benchmark:latest tcp idle-connections --ip 192.168.107.2 --echo-port 9003 --idle-connections 50 --duration 10
```

### Open Connections Per Second
Open a specific number of TCP connections per second and immediately close them once connected.

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_siffleux-net siffleux-benchmark:latest tcp open-connections --ip 192.168.107.2 --echo-port 9003 --open-connections 50 --duration 10
```

## UDP Tests

### Latency
Starts [Siffle](https://github.com/djxy/siffle) to test latency over UDP.

```bash
docker run --rm -it --network siffleux-benchmark_default siffleux-benchmark tcp latency --tunnel siffleux
```

### Bandwidth
Start [Iperf3](https://github.com/esnet/iperf) to test UDP bandwidth and starts [Sockperf](https://github.com/mellanox/sockperf) to test latency over UDP.

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_siffleux-net siffleux-benchmark:latest udp bandwidth --ip 192.168.107.2  --duration 10 --iperf3-port 9002 --sockperf-port 9000
```

### Idle Sockets
Open a number of UDP sockets and keep them idle for the duration of the test. Each socket sends a 1 byte datagram each few seconds to prevent timeouts or expirations on the network path.

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_siffleux-net siffleux-benchmark:latest udp idle-sockets --ip 192.168.107.2  --idle-sockets 50 --duration 10 --echo-port 9003
```

### Open Sockets Per Second
Open a specific number of UDP sockets per second and immediately send some datagrams to the tunnel.

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_siffleux-net siffleux-benchmark:latest udp open-sockets --ip 192.168.107.2 --echo-port 9003 --open-sockets 50 --duration 10
```

## HTTP Tests

### Stress
Test the TCP ingress/egress by sending multiple HTTP requests with [Vegeta](https://github.com/tsenart/vegeta).

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_siffleux-net siffleux-benchmark:latest http stress --ip 192.168.107.2 --sockperf-port 9000 --nginx-port 9001 --duration 10
```
