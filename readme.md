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

## Idle Sockets
Connect a number of TCP sockets to the server and keep them idle for the duration of the test. To prevent timeouts, the connections send 1 byte each few seconds. 

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest tcp idle-sockets --ip 192.168.97.4 --echo-port 9003 --idle-sockets 50 --duration 10
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
Open a number of UDP sockets and keep them idle for the duration of the test. To prevent timeouts, the sockets send a 1 byte datagram each few seconds. 

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest udp idle-sockets --ip 192.168.97.4  --idle-sockets 50 --duration 10 --echo-port 9003
```

# HTTP Tests

## Stress
Test the TCP ingress/egress by sending HTTP requests with [Vegeta](https://github.com/tsenart/vegeta).

```bash
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest http stress --ip 192.168.97.4 --sockperf-port 9000 --nginx-port 9001 --duration 10
```
