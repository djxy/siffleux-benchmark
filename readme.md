## Installation
*Work in progress...*

```bash
docker build -t siffleux-benchmark .
```

# TCP Tests

## Latency
Starts [Sockperf](https://github.com/mellanox/sockperf) to test latency with a TCP connection.

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest tcp latency --ip 192.168.97.4 --sockperf-port 9000 --duration 10
```

## Bandwidth
Start [Iperf3](https://github.com/esnet/iperf) to test TCP bandwidth and starts [Sockperf](https://github.com/mellanox/sockperf) and test latency with a TCP connection.

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest tcp bandwidth --ip 192.168.97.4 --sockperf-port 9000 --iperf3-port 9002 --duration 10
```

## Idle Connections
Create multiple TCP connections to the server and keep them idle for the duration of the test. To prevent timeouts, each connection sends 1 byte each few seconds. 

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest tcp idle-connections --ip 192.168.97.4 --echo-port 9003 --idle-connections 50 --duration 10
```

## Open Connections Per Second
Open a specific number of TCP connections per second and immediately close them once connected.

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest tcp open-connections --ip 192.168.97.4 --echo-port 9003 --open-connections 50 --duration 10
```

# UDP Tests

## Latency
Starts [Sockperf](https://github.com/mellanox/sockperf) to test latency over UDP.

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest udp latency --ip 192.168.97.4  --duration 10 --sockperf-port 9000
```

## Bandwidth
Start [Iperf3](https://github.com/esnet/iperf) to test UDP bandwidth and starts [Sockperf](https://github.com/mellanox/sockperf) to test latency over UDP.

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest udp bandwidth --ip 192.168.97.4  --duration 10 --iperf3-port 9002 --sockperf-port 9000
```

## Idle Sockets
Open a number of UDP sockets and keep them idle for the duration of the test. Each socket sends a 1 byte datagram each few seconds to prevent timeouts or expirations on the network path.

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest udp idle-sockets --ip 192.168.97.4  --idle-sockets 50 --duration 10 --echo-port 9003
```

## Open Sockets Per Second
Open a specific number of UDP sockets per second and immediately send some datagrams to the tunnel.

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest udp open-sockets --ip 192.168.97.4 --echo-port 9003 --open-sockets 50 --duration 10
```

# HTTP Tests

## Stress
Test the TCP ingress/egress by sending multiple HTTP requests with [Vegeta](https://github.com/tsenart/vegeta).

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest http stress --ip 192.168.97.4 --sockperf-port 9000 --nginx-port 9001 --duration 10
```
