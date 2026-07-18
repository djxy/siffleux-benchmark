import logger from "./logger.js";
import { Process, sleep } from "./process.js";
import fs from "fs/promises";
import net from "net";

export interface ServerConfig {
  server_ip: string;
}

export interface DurationConfig {
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

export type LatencyTestConfig = ServerConfig & DurationConfig & SockperfConfig;

export type TcpOpenConnectionTestConfig = ServerConfig & TcpEchoConfig;

export type TcpIdleConnectionTestConfig = ServerConfig &
  DurationConfig &
  TcpEchoConfig;

export type TcpBandwidthTestConfig = ServerConfig &
  DurationConfig &
  SockperfConfig &
  Iperf3Config;

export type HttpTestConfig = ServerConfig &
  DurationConfig &
  SockperfConfig &
  VegetaConfig &
  NginxConfig;

interface ConnectionResult {
  status: "success" | "error" | "timeout";
  duration_ns: number;
}

async function create_results_folder() {
  const folder = `/results/${new Date().toISOString().replace(/:/g, "-")}`;
  await fs.mkdir(folder, { recursive: true });
  return folder;
}

function handleSigint(...processes: Process[]) {
  process.once("SIGINT", () => {
    logger.info("\nTest aborted.");
    processes.forEach((p) => p.kill());
  });
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

  handleSigint(vegeta, sockperf);

  await Promise.all([vegeta.closed(), sockperf.closed()]);

  logger.info("Finished http test.");
}

export async function launch_latency_test(config: LatencyTestConfig) {
  const results_folder = await create_results_folder();

  await fs.mkdir(results_folder, { recursive: true });

  logger.info("Starting latency test.");

  const sockperf = launch_sockperf(config, results_folder);

  logger.info("Sockperf started.");

  handleSigint(sockperf);

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

  handleSigint(iperf3, sockperf);

  await Promise.all([iperf3.closed(), sockperf.closed()]);

  logger.info("Finished tcp bandwidth test.");
}

function launch_sockperf(
  config: ServerConfig & DurationConfig & SockperfConfig,
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

export async function launch_tcp_open_connection_test(
  config: TcpOpenConnectionTestConfig,
) {
  logger.info("Starting tcp open connection test.");

  const bytes = Buffer.from([0x01]);
  const test_started_at = process.hrtime.bigint();
  const results: ConnectionResult[] = await Promise.all(
    Array.from(
      { length: config.tcp_echo.connections },
      (_, i) =>
        new Promise<ConnectionResult>((res) => {
          const start = process.hrtime.bigint();
          const socket = new net.Socket();
          let completed = false;

          const terminate = (status: "success" | "error" | "timeout") => {
            if (completed) return;
            completed = true;
            socket.destroy();

            const end = process.hrtime.bigint();

            res({ status, duration_ns: Number(end - start) });
          };

          socket.setTimeout(10_000);

          socket.connect(
            {
              port: config.tcp_echo.port,
              host: config.server_ip,
            },
            () => {
              socket.write(bytes);
            },
          );

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

  logger.info(
    `Total Time for test: ${Number(test_ended_at - test_started_at) / 1e6}ms`,
  );
  logger.info(
    `Successful connections: ${successful.length}/${config.tcp_echo.connections}`,
  );
  logger.info(`Failed connections: ${failed.length}`);

  if (successful.length > 0) {
    const getPercentile = (p: number) =>
      latencies[
        Math.min(latencies.length - 1, Math.floor(latencies.length * p))
      ] as number;

    logger.info(`Latency Percentiles (TTFB):`);
    logger.info(`  Min:  ${((latencies[0] as number) / 1e6).toFixed(2)}ms`);
    logger.info(`  p50:  ${(getPercentile(0.5) / 1e6).toFixed(2)}ms`);
    logger.info(`  p95:  ${(getPercentile(0.95) / 1e6).toFixed(2)}ms`);
    logger.info(`  p99:  ${(getPercentile(0.99) / 1e6).toFixed(2)}ms`);
    logger.info(
      `  Max:  ${((latencies[latencies.length - 1] as number) / 1e6).toFixed(2)}ms`,
    );
  }

  logger.info("Finished tcp open connection test.");
}

export async function launch_tcp_idle_connection_test(
  config: TcpIdleConnectionTestConfig,
) {
  logger.info("Starting tcp idle connection test.");
  let socket_timeouts = 0;
  let socket_errors = 0;

  logger.info(`Launching connections.`);

  const sockets = await Promise.all(
    Array.from(
      { length: config.tcp_echo.connections },
      (_, i) =>
        new Promise<net.Socket>((res) => {
          const socket = new net.Socket();

          socket.setTimeout(10_000);

          socket.connect(
            {
              port: config.tcp_echo.port,
              host: config.server_ip,
            },
            () => {
              res(socket);

              let interval_id = setInterval(
                () => {
                  let value = Math.floor(Math.random() * 100);

                  if (socket.writableEnded) {
                    return;
                  }

                  socket.write(Buffer.from([value]));

                  socket.once("data", (data) => {
                    if (data[0] !== value) {
                      socket_errors++;
                      socket.end();
                    }
                  });
                },
                Math.floor(3000 + Math.random() * 4000),
              ); // Random between 3-7 seconds between packets to not timeout connection.

              socket.once("end", () => {
                clearInterval(interval_id);
              });
            },
          );

          socket.once("timeout", (e) => {
            logger.error(e);
            socket_timeouts++;
            res(socket);
          });
          socket.once("error", (e) => {
            logger.error(e);
            socket_errors++;
            res(socket);
          });
        }),
    ),
  );

  logger.info(
    `Launched ${config.tcp_echo.connections} idle connections for ${config.duration_seconds} seconds.`,
  );

  await sleep(config.duration_seconds);

  sockets.forEach((socket) => {
    socket.end();
  });

  logger.info(`Closed connections.`);

  logger.info(
    `Successful connections: ${config.tcp_echo.connections - socket_errors}`,
  );
  logger.info(`Failed connections: ${socket_errors - socket_timeouts}`);
  logger.info(`Timeout connections: ${socket_timeouts}`);

  logger.info("Finished tcp idle connection test.");
}
