import { Process, sleep } from "./process.js";

export interface TcpThroughputTestConfig {
  server_ip: string;
  duration_seconds: number;
  iperf3: {
    parallelism: number;
    port: number;
  };
  sockperf: {
    port: number;
  };
}

export interface HttpStressTestConfig {
  server_ip: string;
  duration_seconds: number;
  nginx: {
    port: number;
  };
  sockperf: {
    port: number;
  };
}

export async function launch_http_stress_test(config: HttpStressTestConfig) {
  console.log("Starting http test.");

  const sockperf = Process.spawn(
    "sockperf",
    "ping-pong",
    "--tcp",
    "-i",
    config.server_ip,
    "-p",
    `${config.sockperf.port}`,
    "-t",
    `${config.duration_seconds + 2}`,
  );

  console.log(
    "Sockperf started. Starting vegeta in 2 seconds." +
      new Date().toISOString(),
  );

  await sleep(2);

  const vegeta = Process.spawn(
    "sh",
    "-c",
    `echo "GET http://${config.server_ip}:${config.nginx.port}" | vegeta attack -max-workers 1 -rate 0 -duration ${config.duration_seconds}s | vegeta report -every=1s`,
  );

  console.log("Vegeta started." + new Date().toISOString());

  process.on("SIGINT", () => {
    sockperf.kill();
    vegeta.kill();
  });

  await Promise.all([vegeta.closed(), sockperf.closed()]);

  console.log("Finished http test.");
}

export async function launch_tcp_throughput_test(
  config: TcpThroughputTestConfig,
) {
  console.log("Starting tcp throughput test.");

  const sockperf = Process.spawn(
    "sockperf",
    "ping-pong",
    "--tcp",
    "-i",
    config.server_ip,
    "-p",
    `${config.sockperf.port}`,
    "-t",
    `${config.duration_seconds + 2}`,
  );

  console.log("Sockperf started. Starting iperf3 in 2 seconds.");

  await sleep(2);

  const iperf3 = Process.spawn(
    "iperf3",
    "-c",
    config.server_ip,
    "-p",
    `${config.iperf3.port}`,
    "-P",
    `${config.iperf3.parallelism}`,
    "-t",
    `${config.duration_seconds}`,
  );

  console.log("Iperf3 started.");

  process.on("SIGINT", () => {
    sockperf.kill();
    iperf3.kill();
  });

  await Promise.all([iperf3.closed(), sockperf.closed()]);

  console.log("Finished tcp throughput test.");
}
