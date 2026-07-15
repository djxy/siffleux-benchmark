import logger from "./logger.js";
import { Process, sleep } from "./process.js";
import fs from "fs/promises";
import net from "net";

export interface ServerConfig {
  server_ip: string;
}

export interface TestConfig {
  duration_seconds: number;
}

export interface SockperfConfig {
  sockperf: {
    port: number;
  };
}

export interface Iperf3Config {
  iperf3: {
    parallelism: number;
    port: number;
  };
}

export interface VegetaConfig {
  vegeta: {
    max_workers: number;
  };
}

export interface NginxConfig {
  nginx: {
    port: number;
  };
}

export interface TcpEchoConfig {
  tcp_echo: {
    connections: number;
    port: number;
  };
}

export type LatencyTestConfig = ServerConfig & TestConfig & SockperfConfig;

export type TcpConnectionTestConfig = ServerConfig & TcpEchoConfig;

export type TcpBandwidthTestConfig = ServerConfig &
  TestConfig &
  SockperfConfig &
  Iperf3Config;

export type HttpTestConfig = ServerConfig &
  TestConfig &
  SockperfConfig &
  VegetaConfig &
  NginxConfig;

async function create_results_folder() {
  const folder = `/results/${new Date().toISOString()}`;

  await fs.mkdir(folder, { recursive: true });

  return folder;
}

export async function launch_http_stress_test(config: HttpTestConfig) {
  const results_folder = await create_results_folder();

  await fs.mkdir(results_folder, { recursive: true });

  logger.info("Starting http test.");

  const sockperf = launch_sockperf(config, results_folder);

  logger.info("Sockperf started. Starting vegeta in 2 seconds.");

  await sleep(2);

  const vegeta = Process.spawn({
    cmd: "sh",
    args: [
      "-c",
      `echo "GET http://${config.server_ip}:${config.nginx.port}" | vegeta attack -max-workers ${config.vegeta.max_workers} -rate 0 -duration ${config.duration_seconds}s | vegeta report -every=1s`,
    ],
    name: "vegeta",
    logs_folder: results_folder,
  });

  logger.info("Vegeta started.");

  process.on("SIGINT", () => {
    sockperf.kill();
    vegeta.kill();
  });

  await Promise.all([vegeta.closed(), sockperf.closed()]);

  logger.info("Finished http test.");
}

export async function launch_latency_test(config: LatencyTestConfig) {
  const results_folder = await create_results_folder();

  await fs.mkdir(results_folder, { recursive: true });

  logger.info("Starting latency test.");

  const sockperf = launch_sockperf(config, results_folder);

  logger.info("Sockperf started.");

  process.on("SIGINT", () => {
    sockperf.kill();
  });

  await Promise.all([sockperf.closed()]);

  logger.info("Finished latency test.");
}

export async function launch_tcp_bandwidth_test(
  config: TcpBandwidthTestConfig,
) {
  const results_folder = await create_results_folder();

  logger.info("Starting tcp bandwidth test.");

  const sockperf = launch_sockperf(config, results_folder);

  logger.info("Sockperf started. Starting iperf3 in 2 seconds.");

  await sleep(2);

  const iperf3 = Process.spawn({
    cmd: "iperf3",
    args: [
      "-c",
      config.server_ip,
      "-p",
      `${config.iperf3.port}`,
      "-P",
      `${config.iperf3.parallelism}`,
      "-t",
      `${config.duration_seconds}`,
    ],
    logs_folder: results_folder,
  });

  logger.info("Iperf3 started.");

  process.on("SIGINT", () => {
    sockperf.kill();
    iperf3.kill();
  });

  await Promise.all([iperf3.closed(), sockperf.closed()]);

  logger.info("Finished tcp bandwidth test.");
}

function launch_sockperf(
  config: ServerConfig & TestConfig & SockperfConfig,
  results_folder: string,
) {
  return Process.spawn({
    cmd: "sockperf",
    args: [
      "ping-pong",
      "--tcp",
      "-i",
      config.server_ip,
      "-p",
      `${config.sockperf.port}`,
      "-t",
      `${config.duration_seconds + 2}`,
    ],
    logs_folder: results_folder,
  });
}

interface ConnectionResult {
  status: "success" | "error" | "timeout";
  duration_ns: number;
}

export async function launch_tcp_connection_test(
  config: TcpConnectionTestConfig,
) {
  logger.info("Starting tcp connection test.");
  const bytes = Buffer.from([0x01]);
  const test_started_at = process.hrtime.bigint();
  logger.info(config.tcp_echo.connections);

  const results: ConnectionResult[] = await Promise.all(
    Array.from(
      { length: config.tcp_echo.connections },
      (_, i) =>
        new Promise<ConnectionResult>((res) => {
          if (i === 402) {
            logger.info("start");
          }
          const start = process.hrtime.bigint();
          if (i === 402) {
            logger.info("hrtime");
          }
          const socket = new net.Socket();
          if (i === 402) {
            logger.info("socket");
          }
          let completed = false;

          const terminate = (status: "success" | "error" | "timeout") => {
            if (completed) return;
            if (i === 402) {
              logger.info("terminate");
            }
            completed = true;
            socket.destroy();

            const end = process.hrtime.bigint();

            res({ status, duration_ns: Number(end - start) });
          };

          socket.setTimeout(10_000);
          if (i === 402) {
            logger.info("setTimeout");
          }

          socket.connect(3001, config.server_ip, () => {
            if (i === 402) {
              logger.info("connected");
            }
            socket.write(bytes);
          });
          if (i === 402) {
            logger.info("connecting");
          }

          socket.once("data", () => {
            terminate("success");
          });

          socket.on("timeout", () => terminate("timeout"));
          socket.on("error", (e) => {
            logger.info(e);
            terminate("error");
          });
        }),
    ),
  );

  const test_ended_at = process.hrtime.bigint();

  const successful = results.filter((r) => r.status === "success");
  const failed = results.filter((r) => r.status !== "success");
  const latencies = successful.map((r) => r.duration_ns).sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;

  logger.info(
    `Total Time for test: ${Number(test_ended_at - test_started_at) / 1e6}ms`,
  );
  logger.info(
    `Successful connections: ${successful.length}/${config.tcp_echo.connections}`,
  );
  logger.info(`Failed connections: ${failed.length}`);

  if (successful.length > 0) {
    logger.info(`Latency Percentiles (TTFB):`);
    logger.info(`  Min:  ${(min / 1e6).toFixed(2)}ms`);
    logger.info(`  p50:  ${(p50 / 1e6).toFixed(2)}ms`);
    logger.info(`  p95:  ${(p95 / 1e6).toFixed(2)}ms`);
    logger.info(`  p99:  ${(p99 / 1e6).toFixed(2)}ms`);
    logger.info(`  Max:  ${(max / 1e6).toFixed(2)}ms`);
  }

  logger.info("Finished tcp bandwidth test.");
}
