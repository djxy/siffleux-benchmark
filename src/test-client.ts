import logger from "./logger.js";
import { Process, sleep_ms, sleep_seconds } from "./process.js";
import { mkdir } from "fs/promises";
import net, { Socket } from "net";
import dgram from "dgram";
import type { StartTunnelConfig, TunnelOutputFiles } from "./tunnel.js";
import {
  create_iperf3_chart,
  create_siffle_chart,
  create_vegeta_chart,
} from "./charts.js";
import {
  save_report,
  create_siffle_report_summary,
  create_vegeta_report_summary,
  create_pidstat_report_summary,
} from "./report.js";

export interface TestConfig {
  test: {
    group: string;
    name: string;
  };
}

export interface TunnelConfig {
  tunnel: {
    id: string;
    client_endpoint: string;
    server_endpoint: string;
  };
}

export interface ServerConfig {
  server_ip: string;
}

export interface DurationConfig {
  duration_seconds: number;
}

export interface Iperf3Config {
  iperf3: {
    parallelism: number;
    port: number;
    bandwidth: string;
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

export interface SiffleConfig {
  siffle: {
    port: number;
  };
}

export interface IdleConnectionConfig {
  idle_connection: {
    connections: number;
  };
}

export interface OpenConnectionConfig {
  open_connection: {
    connections_per_second: number;
  };
}

export interface IdleSocketConfig {
  idle_socket: {
    sockets: number;
  };
}

export interface OpenSocketConfig {
  open_socket: {
    sockets_per_second: number;
  };
}

export interface EchoConfig {
  echo: {
    port: number;
  };
}

export type LatencyTestConfig = ServerConfig &
  DurationConfig &
  SiffleConfig &
  TunnelConfig &
  TestConfig;

export type TcpBandwidthTestConfig = ServerConfig &
  DurationConfig &
  Iperf3Config &
  SiffleConfig &
  TunnelConfig &
  TestConfig;

export type TcpIdleConnectionTestConfig = ServerConfig &
  IdleConnectionConfig &
  EchoConfig &
  DurationConfig &
  SiffleConfig &
  TunnelConfig &
  TestConfig;

export type TcpOpenConnectionTestConfig = ServerConfig &
  OpenConnectionConfig &
  EchoConfig &
  DurationConfig &
  SiffleConfig &
  TunnelConfig &
  TestConfig;

export type UdpBandwidthTestConfig = ServerConfig &
  DurationConfig &
  Iperf3Config &
  SiffleConfig &
  TunnelConfig &
  TestConfig;

export type UdpIdleSocketTestConfig = ServerConfig &
  IdleSocketConfig &
  EchoConfig &
  DurationConfig &
  SiffleConfig &
  TunnelConfig &
  TestConfig;

export type UdpOpenSocketTestConfig = ServerConfig &
  OpenSocketConfig &
  EchoConfig &
  DurationConfig &
  SiffleConfig &
  TunnelConfig &
  TestConfig;

export type HttpTestConfig = ServerConfig &
  DurationConfig &
  VegetaConfig &
  NginxConfig &
  SiffleConfig &
  TunnelConfig &
  TestConfig;

export interface TestClientOutputFiles {
  report: string;
  siffle_stdout: string;
  siffle_stderr: string;
  siffle_graph_jpg: string;
  vegeta_stdout: string;
  vegeta_stderr: string;
  vegeta_graph_jpg: string;
  iperf3_stdout: string;
  iperf3_stderr: string;
  iperf3_graph_jpeg: string;
}

interface TestOutputFiles {
  test_client: TestClientOutputFiles;
  tunnel_client: TunnelOutputFiles;
  tunnel_server: TunnelOutputFiles;
}

async function create_test_output_files(
  config: TunnelConfig & TestConfig,
): Promise<TestOutputFiles> {
  const test_output_folder = `/tests/${config.test.group}`;
  const test_output_file_prefix = `${test_output_folder}/${config.test.name}`;

  await mkdir(test_output_folder, { recursive: true });

  return {
    test_client: {
      report: `${test_output_folder}/report.md`,
      siffle_stdout: `${test_output_file_prefix}-siffle.json`,
      siffle_stderr: `${test_output_file_prefix}-siffle.err`,
      siffle_graph_jpg: `${test_output_file_prefix}-siffle.jpeg`,
      vegeta_stdout: `${test_output_file_prefix}-vegeta.ndjson`,
      vegeta_stderr: `${test_output_file_prefix}-vegeta.err`,
      vegeta_graph_jpg: `${test_output_file_prefix}-vegeta.jpeg`,
      iperf3_stdout: `${test_output_file_prefix}-iperf3.json`,
      iperf3_stderr: `${test_output_file_prefix}-iperf3.err`,
      iperf3_graph_jpeg: `${test_output_file_prefix}-iperf3.jpeg`,
    },
    tunnel_client: {
      tunnel_stdout: `${test_output_file_prefix}-${config.tunnel.id}-client.log`,
      tunnel_stderr: `${test_output_file_prefix}-${config.tunnel.id}-client.err`,
      pidstat_stdout: `${test_output_file_prefix}-${config.tunnel.id}-client-pidstat.log`,
      pidstat_stderr: `${test_output_file_prefix}-${config.tunnel.id}-client-pidstat.err`,
      pidstat_graph_jpg: `${test_output_file_prefix}-${config.tunnel.id}-client-pidstat.jpeg`,
    },
    tunnel_server: {
      tunnel_stdout: `${test_output_file_prefix}-${config.tunnel.id}-server.log`,
      tunnel_stderr: `${test_output_file_prefix}-${config.tunnel.id}-server.err`,
      pidstat_stdout: `${test_output_file_prefix}-${config.tunnel.id}-server-pidstat.log`,
      pidstat_stderr: `${test_output_file_prefix}-${config.tunnel.id}-server-pidstat.err`,
      pidstat_graph_jpg: `${test_output_file_prefix}-${config.tunnel.id}-server-pidstat.jpeg`,
    },
  };
}

const TUNNELS: {
  [tunnel_id: string]: {
    client: (output_files: TunnelOutputFiles) => StartTunnelConfig;
    server: (output_files: TunnelOutputFiles) => StartTunnelConfig;
  };
} = {
  siffleux: {
    client: (output_files) => ({
      output_files,
      cmd: "siffleux",
      args: ["client", "--config=/app/configs/siffleux/client.toml"],
    }),
    server: (output_files) => ({
      output_files,
      cmd: "siffleux",
      args: ["server", "--config=/app/configs/siffleux/server.toml"],
    }),
  },
  rathole: {
    client: (output_files) => ({
      output_files,
      cmd: "rathole",
      args: ["--client", "/app/configs/rathole-noise/client.toml"],
    }),
    server: (output_files) => ({
      output_files,
      cmd: "rathole",
      args: ["--server", "/app/configs/rathole-noise/server.toml"],
    }),
  },
  "frp-tls": {
    client: (output_files) => ({
      output_files,
      cmd: "frpc",
      args: ["-c", "/app/configs/frp-tls/client.toml"],
    }),
    server: (output_files) => ({
      output_files,
      cmd: "frps",
      args: ["-c", "/app/configs/frp-tls/server.toml"],
    }),
  },
  "frp-quic": {
    client: (output_files) => ({
      output_files,
      cmd: "frpc",
      args: ["-c", "/app/configs/frp-quic/client.toml"],
    }),
    server: (output_files) => ({
      output_files,
      cmd: "frps",
      args: ["-c", "/app/configs/frp-quic/server.toml"],
    }),
  },
};

function handleSigint(...processes: Process[]) {
  process.once("SIGINT", () => {
    logger.info("Test aborted.");
    processes.forEach((p) => p.kill());
  });
}

export async function launch_http_stress_test(config: HttpTestConfig) {
  logger.info("Starting HTTP stress test.");

  const test_output_files = await create_test_output_files(config);

  await start_tunnels(config, test_output_files);

  const siffle = launch_siffle(config, "tcp", test_output_files);
  const vegeta = Process.spawn({
    cmd: "sh",
    args: [
      "-c",
      `echo "GET http://${config.server_ip}:${config.nginx.port}" | vegeta attack -max-workers ${config.vegeta.max_workers} -rate 0 -duration ${config.duration_seconds}s | vegeta report -every=1s -type=json`,
    ],
    stderr_file: test_output_files.test_client.vegeta_stderr,
    stdout_file: test_output_files.test_client.vegeta_stdout,
  });

  logger.info("Vegeta started.");

  handleSigint(vegeta, siffle);

  await Promise.all([vegeta.closed(), siffle.closed()]);

  await stop_tunnels(config);

  await Promise.all([
    create_siffle_chart(test_output_files.test_client, "TCP"),
    create_vegeta_chart(test_output_files.test_client),
  ]);

  await save_report(
    config,
    [
      create_vegeta_report_summary(test_output_files.test_client),
      create_pidstat_report_summary(
        test_output_files.tunnel_client,
        config.tunnel.id,
        "client",
      ),
      create_pidstat_report_summary(
        test_output_files.tunnel_server,
        config.tunnel.id,
        "server",
      ),
      create_siffle_report_summary(test_output_files.test_client),
    ],
    test_output_files.test_client,
  );

  logger.info("Finished HTTP stress test.");
}

export async function launch_tcp_latency_test(config: LatencyTestConfig) {
  const test_output_files = await create_test_output_files(config);

  await start_tunnels(config, test_output_files);

  logger.info("Starting TCP latency test.");

  const siffle = launch_siffle(config, "tcp", test_output_files);

  logger.info("Siffle started.");

  handleSigint(siffle);

  await Promise.all([siffle.closed()]);

  await stop_tunnels(config);

  await create_siffle_chart(test_output_files.test_client, "TCP");

  await save_report(
    config,
    [create_siffle_report_summary(test_output_files.test_client)],
    test_output_files.test_client,
  );

  logger.info("Finished latency test.");
}

export async function launch_tcp_bandwidth_test(
  config: TcpBandwidthTestConfig,
) {
  logger.info("Starting TCP bandwidth test.");

  const test_output_files = await create_test_output_files(config);

  await start_tunnels(config, test_output_files);

  const siffle = launch_siffle(config, "tcp", test_output_files);

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
      "-J",
    ],
    stderr_file: test_output_files.test_client.iperf3_stderr,
    stdout_file: test_output_files.test_client.iperf3_stdout,
  });

  logger.info("Iperf3 started.");

  handleSigint(iperf3, siffle);

  await Promise.all([iperf3.closed(), siffle.closed()]);

  await stop_tunnels(config);

  await Promise.all([
    create_iperf3_chart(test_output_files.test_client, "TCP"),
    create_siffle_chart(test_output_files.test_client, "TCP"),
  ]);

  logger.info("Finished TCP bandwidth test.");
}

export async function launch_tcp_idle_connection_test(
  config: TcpIdleConnectionTestConfig,
) {
  logger.info("Starting TCP idle connections test.");

  const test_output_files = await create_test_output_files(config);

  await start_tunnels(config, test_output_files);

  const siffle = launch_siffle(config, "tcp", test_output_files);

  let socket_timeouts = 0;
  let socket_errors = 0;

  const sockets = await Promise.all(
    Array.from(
      { length: config.idle_connection.connections },
      () =>
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
                      socket.destroy();
                    }
                  });
                },
                Math.floor(3000 + Math.random() * 4000),
              ); // Random between 3-7 seconds between packets to not timeout connection.

              socket.once("close", () => {
                clearInterval(interval_id);
              });
            },
          );

          socket.once("timeout", () => {
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

  handleSigint(siffle);

  logger.info(
    `Testing ${config.idle_connection.connections} idle connections for ${config.duration_seconds} seconds.`,
  );

  await sleep_seconds(config.duration_seconds);

  sockets.forEach((socket) => {
    socket.destroy();
  });

  await Promise.all([siffle.closed()]);

  await stop_tunnels(config);

  await create_siffle_chart(test_output_files.test_client, "TCP");

  logger.info(`Closed connections.`);

  logger.info(
    `Successful connections: ${config.idle_connection.connections - socket_errors}`,
  );
  logger.info(`Failed connections: ${socket_errors}`);
  logger.info(`Timeout connections: ${socket_timeouts}`);

  logger.info("Finished TCP idle connections test.");
}

export async function launch_tcp_open_connections_test(
  config: TcpOpenConnectionTestConfig,
) {
  logger.info("Starting TCP open connections test.");

  const test_output_files = await create_test_output_files(config);

  await start_tunnels(config, test_output_files);

  const siffle = launch_siffle(config, "tcp", test_output_files);

  let connection_id_counter = 0;
  let connected = 0;
  let timeouts = 0;
  let errors = 0;

  const connections = new Map<number, Socket>();
  const open_connections = () =>
    Array.from(
      { length: config.open_connection.connections_per_second },
      () => {
        const socket_id = connection_id_counter++;
        const socket = new net.Socket();

        connections.set(socket_id, socket);

        socket.setTimeout(10_000);

        socket.connect(
          {
            port: config.echo.port,
            host: config.server_ip,
          },
          () => {
            socket.end();
            connected++;
          },
        );

        socket.once("close", () => {
          connections.delete(socket_id);
        });
        socket.once("timeout", () => {
          socket.destroy();
          timeouts++;
        });
        socket.once("error", (e) => {
          logger.error(e);
          errors++;
        });
      },
    );

  handleSigint(siffle);

  let interval_id = setInterval(open_connections, 1000);

  open_connections();

  logger.info(
    `Opening ${config.open_connection.connections_per_second} connections per second for ${config.duration_seconds} seconds.`,
  );

  await sleep_seconds(config.duration_seconds);

  clearInterval(interval_id);

  connections.forEach((socket) => {
    socket.destroy();
  });

  await Promise.all([siffle.closed()]);

  await stop_tunnels(config);

  await create_siffle_chart(test_output_files.test_client, "TCP");

  logger.info(`Successful connections: ${connected}`);
  logger.info(`Failed connections: ${errors}`);
  logger.info(`Timeout connections: ${timeouts}`);

  logger.info("Finished TCP open connections test.");
}

export async function launch_udp_idle_socket_test(
  config: UdpIdleSocketTestConfig,
) {
  logger.info("Starting UDP idle sockets test.");

  const test_output_files = await create_test_output_files(config);

  await start_tunnels(config, test_output_files);

  const siffle = launch_siffle(config, "udp", test_output_files);

  let sockets_received_datagrams = 0;
  let datagrams_sent = 0;
  let datagrams_received = 0;

  const sockets: [dgram.Socket, NodeJS.Timeout][] = await Promise.all(
    Array.from(
      { length: config.idle_socket.sockets },
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

  handleSigint(siffle);

  logger.info(
    `Testing ${config.idle_socket.sockets} idle sockets for ${config.duration_seconds} seconds.`,
  );

  await sleep_seconds(config.duration_seconds);

  sockets.forEach(([socket, timeout_id]) => {
    socket.close();
    clearTimeout(timeout_id);
  });

  await Promise.all([siffle.closed()]);

  await stop_tunnels(config);

  await create_siffle_chart(test_output_files.test_client, "UDP");

  logger.info(`Closed sockets.`);

  logger.info(`Datagrams sent: ${datagrams_sent}.`);
  logger.info(`Datagrams received: ${datagrams_received}.`);
  logger.info(
    `Sockets received datagrams: ${sockets_received_datagrams}/${config.idle_socket.sockets}.`,
  );

  logger.info("Finished UDP idle sockets test.");
}

export async function launch_udp_latency_test(config: LatencyTestConfig) {
  const test_output_files = await create_test_output_files(config);

  await start_tunnels(config, test_output_files);

  logger.info("Starting UDP latency test.");

  const siffle = launch_siffle(config, "udp", test_output_files);

  logger.info("Siffle started.");

  handleSigint(siffle);

  await Promise.all([siffle.closed()]);

  await stop_tunnels(config);

  await create_siffle_chart(test_output_files.test_client, "UDP");

  logger.info("Finished latency test.");
}

export async function launch_udp_bandwidth_test(
  config: UdpBandwidthTestConfig,
) {
  logger.info("Starting UDP bandwidth test.");

  const test_output_files = await create_test_output_files(config);

  await start_tunnels(config, test_output_files);

  const siffle = launch_siffle(config, "udp", test_output_files);

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
      "-J",
    ],
    stderr_file: test_output_files.test_client.iperf3_stderr,
    stdout_file: test_output_files.test_client.iperf3_stdout,
  });

  logger.info("Iperf3 started.");

  handleSigint(iperf3, siffle);

  await Promise.all([iperf3.closed(), siffle.closed()]);

  await stop_tunnels(config);

  await Promise.all([
    create_iperf3_chart(test_output_files.test_client, "UDP"),
    create_siffle_chart(test_output_files.test_client, "UDP"),
  ]);

  logger.info("Finished UDP bandwidth test.");
}

export async function launch_udp_open_sockets_test(
  config: UdpOpenSocketTestConfig,
) {
  logger.info("Starting UDP open sockets test.");

  const test_output_files = await create_test_output_files(config);

  await start_tunnels(config, test_output_files);

  const siffle = launch_siffle(config, "udp", test_output_files);

  let socket_id_counter = 0;
  let socket_connected = 0;
  let message_sent = 0;
  let message_received = 0;

  const sockets = new Map<number, dgram.Socket>();
  const open_sockets = () => {
    sockets.forEach((socket) => {
      socket.close();
    });

    sockets.clear();

    Array.from({ length: config.open_socket.sockets_per_second }, () => {
      const socket_id = socket_id_counter++;
      const socket = dgram.createSocket("udp4");

      socket.bind(0, "0.0.0.0", () => {
        socket_connected++;
        sockets.set(socket_id, socket);

        Array.from({ length: 3 }, () => {
          socket.send(Buffer.from([1]), config.echo.port, config.server_ip);
          message_sent++;
        });

        socket.on("message", () => {
          message_received++;
        });
      });
    });
  };

  handleSigint(siffle);

  let interval_id = setInterval(open_sockets, 1000);

  open_sockets();

  logger.info(
    `Opening ${config.open_socket.sockets_per_second} sockets per second for ${config.duration_seconds} seconds.`,
  );

  await sleep_seconds(config.duration_seconds);

  clearInterval(interval_id);

  sockets.forEach((socket) => {
    socket.close();
  });

  await Promise.all([siffle.closed()]);

  await stop_tunnels(config);

  await create_siffle_chart(test_output_files.test_client, "UDP");

  logger.info(`Opened sockets: ${socket_connected}`);
  logger.info(`Message sent: ${message_sent}`);
  logger.info(`Message received: ${message_received}`);

  logger.info("Finished UDP open sockets test.");
}

async function start_tunnels(
  config: TunnelConfig,
  test_output_files: TestOutputFiles,
) {
  await start_tunnel(
    config.tunnel.server_endpoint,
    config.tunnel.id,
    TUNNELS[config.tunnel.id]?.server(
      test_output_files.tunnel_server,
    ) as StartTunnelConfig,
  );
  await sleep_ms(500);
  await start_tunnel(
    config.tunnel.client_endpoint,
    config.tunnel.id,
    TUNNELS[config.tunnel.id]?.client(
      test_output_files.tunnel_client,
    ) as StartTunnelConfig,
  );
  await sleep_ms(1000);
}

async function stop_tunnels(config: TunnelConfig) {
  await stop_tunnel(config.tunnel.client_endpoint, config.tunnel.id);
  await stop_tunnel(config.tunnel.server_endpoint, config.tunnel.id);
}

async function start_tunnel(
  endpoint: string,
  tunnel_id: string,
  config: StartTunnelConfig,
) {
  await fetch(`${endpoint}/tunnels/${tunnel_id}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(config),
  });
}

async function stop_tunnel(endpoint: string, tunnel_id: string) {
  await fetch(`${endpoint}/tunnels/${tunnel_id}`, {
    method: "DELETE",
  });
}

function launch_siffle(
  config: ServerConfig & DurationConfig & SiffleConfig,
  protocol: "udp" | "tcp",
  test_output_files: TestOutputFiles,
) {
  return Process.spawn({
    cmd: "siffle",
    args: [
      protocol,
      "-s",
      config.server_ip,
      "-p",
      `${config.siffle.port}`,
      "-t",
      `${config.duration_seconds}`,
      "--mps=1000",
    ],
    stderr_file: test_output_files.test_client.siffle_stderr,
    stdout_file: test_output_files.test_client.siffle_stdout,
  });
}
