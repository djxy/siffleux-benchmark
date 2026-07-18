```
docker build -t siffleux-benchmark .
```

```
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest http stress --ip 192.168.97.3 --sockperf-port 9000 --nginx-port 9001 --duration 10
```

```
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest tcp latency --ip 192.168.97.3 --sockperf-port 9000 --duration 10
```

```
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest tcp bandwidth --ip 192.168.97.3 --sockperf-port 9000 --iperf3-port 9002 --duration 10
```

```
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest tcp concurrency --ip 192.168.97.3 --tcp-echo-port 9003 --connections 10000
```

```
docker run --rm -it -v ./results:/results --network siffleux-benchmark_default siffleux-benchmark:latest tcp idle --ip 192.168.97.3 --tcp-echo-port 9003 --connections 10000 --duration 10
```
