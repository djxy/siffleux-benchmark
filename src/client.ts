import logger from "./logger.js";
import { Process, sleep } from "./process.js";
import fs from "fs/promises";
import net from "net";
import dgram from "dgram";

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
    bandwidth: string;
  };
}

export interface Iperf3UDPConfig {
  iperf3: {
    payload_size: number;
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

export interface IdleSocketConfig {
  idle_socket: {
    concurrent_sockets: number;
  };
}

export interface EchoConfig {
  echo: {
    port: number;
  };
}

export type LatencyTestConfig = ServerConfig & DurationConfig & SockperfConfig;

export type TcpBandwidthTestConfig = ServerConfig &
  DurationConfig &
  SockperfConfig &
  Iperf3Config;

export type IdleSocketTestConfig = ServerConfig &
  IdleSocketConfig &
  EchoConfig &
  DurationConfig;

export type UdpBandwidthTestConfig = ServerConfig &
  DurationConfig &
  SockperfConfig &
  Iperf3UDPConfig &
  Iperf3Config;

export type UdpOpenConnectionTestConfig = ServerConfig & EchoConfig;

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

  logger.info("Starting HTTP test.");

  const sockperf = launch_sockperf(config, results_folder, "tcp");

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

  logger.info("Finished HTTP test.");
}

export async function launch_tcp_latency_test(config: LatencyTestConfig) {
  const results_folder = await create_results_folder();

  await fs.mkdir(results_folder, { recursive: true });

  logger.info("Starting TCP latency test.");

  const sockperf = launch_sockperf(config, results_folder, "tcp");

  logger.info("Sockperf started.");

  handleSigint(sockperf);

  await Promise.all([sockperf.closed()]);

  logger.info("Finished latency test.");
}

export async function launch_tcp_bandwidth_test(
  config: TcpBandwidthTestConfig,
) {
  const results_folder = await create_results_folder();

  logger.info("Starting TCP bandwidth test.");

  const sockperf = launch_sockperf(config, results_folder, "tcp");

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
      "--bidir",
      "-b",
      `${config.iperf3.bandwidth}`,
    ],
    logs_folder: results_folder,
  });

  logger.info("Iperf3 started.");

  handleSigint(iperf3, sockperf);

  await Promise.all([iperf3.closed(), sockperf.closed()]);

  logger.info("Finished TCP bandwidth test.");
}

export async function launch_tcp_idle_socket_test(
  config: IdleSocketTestConfig,
) {
  logger.info("Starting TCP idle sockets test.");
  let socket_timeouts = 0;
  let socket_errors = 0;

  const sockets = await Promise.all(
    Array.from(
      { length: config.idle_socket.concurrent_sockets },
      (_, i) =>
        new Promise<net.Socket>((res) => {
          const socket = new net.Socket();

          socket.setTimeout(10_000);

          socket.connect(
            {
              port: config.echo.port,
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
    `Testing ${config.idle_socket.concurrent_sockets} idle sockets for ${config.duration_seconds} seconds.`,
  );

  await sleep(config.duration_seconds);

  sockets.forEach((socket) => {
    socket.end();
  });

  logger.info(`Closed sockets.`);

  logger.info(
    `Successful sockets: ${config.idle_socket.concurrent_sockets - socket_errors}`,
  );
  logger.info(`Failed sockets: ${socket_errors - socket_timeouts}`);
  logger.info(`Timeout connections: ${socket_timeouts}`);

  logger.info("Finished TCP idle sockets test.");
}

export async function launch_udp_idle_socket_test(
  config: IdleSocketTestConfig,
) {
  logger.info("Starting UDP idle sockets test.");

  let sockets_received_datagrams = 0;
  let datagrams_sent = 0;
  let datagrams_received = 0;

  const sockets: [dgram.Socket, NodeJS.Timeout][] = await Promise.all(
    Array.from(
      { length: config.idle_socket.concurrent_sockets },
      () =>
        new Promise<[dgram.Socket, NodeJS.Timeout]>((res) => {
          const socket = dgram.createSocket("udp4");

          socket.bind(0, "0.0.0.0", () => {
            let interval_id = setInterval(
              () => {
                socket.send(
                  Buffer.from([Math.floor(Math.random() * 100)]),
                  config.echo.port,
                  config.server_ip,
                );
                datagrams_sent++;
              },
              Math.floor(3000 + Math.random() * 4000),
            ); // Random between 3-7 seconds between packets

            socket.once("message", () => {
              sockets_received_datagrams++;
            });

            socket.on("message", () => {
              datagrams_received++;
            });

            res([socket, interval_id]);
          });
        }),
    ),
  );

  logger.info(
    `Testing ${config.idle_socket.concurrent_sockets} idle sockets for ${config.duration_seconds} seconds.`,
  );

  await sleep(config.duration_seconds);

  sockets.forEach(([socket, timeout_id]) => {
    socket.close();
    clearTimeout(timeout_id);
  });

  logger.info(`Closed sockets.`);

  logger.info(`Datagrams sent: ${datagrams_sent}.`);
  logger.info(`Datagrams received: ${datagrams_received}.`);
  logger.info(
    `Sockets received datagrams: ${sockets_received_datagrams}/${config.idle_socket.concurrent_sockets}.`,
  );

  logger.info("Finished UDP idle sockets test.");
}

export async function launch_udp_latency_test(config: LatencyTestConfig) {
  const results_folder = await create_results_folder();

  await fs.mkdir(results_folder, { recursive: true });

  logger.info("Starting UDP latency test.");

  const sockperf = launch_sockperf(config, results_folder, "udp");

  logger.info("Sockperf started.");

  handleSigint(sockperf);

  await Promise.all([sockperf.closed()]);

  logger.info("Finished latency test.");
}

export async function launch_udp_bandwidth_test(
  config: UdpBandwidthTestConfig,
) {
  const results_folder = await create_results_folder();

  logger.info("Starting UDP bandwidth test.");

  const sockperf = launch_sockperf(config, results_folder, "udp");

  logger.info("Sockperf started. Starting iperf3 in 2 seconds.");

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
      "-u",
      "--bidir",
      "-b",
      `${config.iperf3.bandwidth}`,
      "-l",
      `${config.iperf3.payload_size}`,
    ],
    logs_folder: results_folder,
  });

  logger.info("Iperf3 started.");

  handleSigint(iperf3, sockperf);

  await Promise.all([iperf3.closed(), sockperf.closed()]);

  logger.info("Finished UDP bandwidth test.");
}

function launch_sockperf(
  config: ServerConfig & DurationConfig & SockperfConfig,
  results_folder: string,
  protocol: "udp" | "tcp",
) {
  const args = [
    "ping-pong",
    "-i",
    config.server_ip,
    "-p",
    `${config.sockperf.port}`,
    "-t",
    `${config.duration_seconds + 2}`,
    "--debug",
  ];

  if (protocol === "tcp") {
    args.push("--tcp");
  }

  return Process.spawn({
    cmd: "sockperf",
    args,
    logs_folder: results_folder,
  });
}
