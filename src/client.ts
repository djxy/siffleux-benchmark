import logger from "./logger.js";
import { Process, sleep } from "./process.js";
import fs from "fs/promises";
import net, { Socket } from "net";
import dgram from "dgram";

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

export type LatencyTestConfig = ServerConfig & DurationConfig & EchoConfig;

export type TcpBandwidthTestConfig = ServerConfig &
  DurationConfig &
  EchoConfig &
  Iperf3Config;

export type TcpIdleConnectionTestConfig = ServerConfig &
  IdleConnectionConfig &
  EchoConfig &
  DurationConfig;

export type TcpOpenConnectionTestConfig = ServerConfig &
  OpenConnectionConfig &
  EchoConfig &
  DurationConfig;

export type UdpBandwidthTestConfig = ServerConfig &
  DurationConfig &
  EchoConfig &
  Iperf3UDPConfig &
  Iperf3Config;

export type UdpIdleSocketTestConfig = ServerConfig &
  IdleSocketConfig &
  EchoConfig &
  DurationConfig;

export type UdpOpenSocketTestConfig = ServerConfig &
  OpenSocketConfig &
  EchoConfig &
  DurationConfig;

export type HttpTestConfig = ServerConfig &
  DurationConfig &
  EchoConfig &
  VegetaConfig &
  NginxConfig;

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
  // const results_folder = await create_results_folder();
  // await fs.mkdir(results_folder, { recursive: true });
  // logger.info("Starting HTTP test.");
  // const sockperf = launch_sockperf(config, results_folder, "tcp");
  // logger.info("Sockperf started. Starting vegeta in 2 seconds.");
  // await sleep(2);
  // const vegeta = Process.spawn({
  //   cmd: "sh",
  //   args: [
  //     "-c",
  //     `echo "GET http://${config.server_ip}:${config.nginx.port}" | vegeta attack -max-workers ${config.vegeta.max_workers} -rate 0 -duration ${config.duration_seconds}s | vegeta report -every=1s`,
  //   ],
  //   name: "vegeta",
  //   logs_folder: results_folder,
  // });
  // logger.info("Vegeta started.");
  // handleSigint(vegeta, sockperf);
  // await Promise.all([vegeta.closed(), sockperf.closed()]);
  // logger.info("Finished HTTP test.");
}

export async function launch_tcp_latency_test(config: LatencyTestConfig) {
  // const results_folder = await create_results_folder();
  // await fs.mkdir(results_folder, { recursive: true });
  // logger.info("Starting TCP latency test.");
  // const sockperf = launch_sockperf(config, results_folder, "tcp");
  // logger.info("Sockperf started.");
  // handleSigint(sockperf);
  // await Promise.all([sockperf.closed()]);
  // logger.info("Finished latency test.");
}

export async function launch_tcp_bandwidth_test(
  config: TcpBandwidthTestConfig,
) {
  // const results_folder = await create_results_folder();
  // logger.info("Starting TCP bandwidth test.");
  // const sockperf = launch_sockperf(config, results_folder, "tcp");
  // logger.info("Sockperf started. Starting iperf3 in 2 seconds.");
  // await sleep(2);
  // const iperf3 = Process.spawn({
  //   cmd: "iperf3",
  //   args: [
  //     "-c",
  //     config.server_ip,
  //     "-p",
  //     `${config.iperf3.port}`,
  //     "-P",
  //     `${config.iperf3.parallelism}`,
  //     "-t",
  //     `${config.duration_seconds}`,
  //     "--bidir",
  //     "-b",
  //     `${config.iperf3.bandwidth}`,
  //   ],
  //   logs_folder: results_folder,
  // });
  // logger.info("Iperf3 started.");
  // handleSigint(iperf3, sockperf);
  // await Promise.all([iperf3.closed(), sockperf.closed()]);
  // logger.info("Finished TCP bandwidth test.");
}

export async function launch_tcp_idle_connection_test(
  config: TcpIdleConnectionTestConfig,
) {
  logger.info("Starting TCP idle connections test.");
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

  logger.info(
    `Testing ${config.idle_connection.connections} idle connections for ${config.duration_seconds} seconds.`,
  );

  await sleep(config.duration_seconds);

  sockets.forEach((socket) => {
    socket.destroy();
  });

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

  let interval_id = setInterval(open_connections, 1000);

  open_connections();

  logger.info(
    `Opening ${config.open_connection.connections_per_second} connections per second for ${config.duration_seconds} seconds.`,
  );

  await sleep(config.duration_seconds);

  clearInterval(interval_id);

  connections.forEach((socket) => {
    socket.destroy();
  });

  logger.info(`Successful connections: ${connected}`);
  logger.info(`Failed connections: ${errors}`);
  logger.info(`Timeout connections: ${timeouts}`);

  logger.info("Finished TCP open connections test.");
}

export async function launch_udp_idle_socket_test(
  config: UdpIdleSocketTestConfig,
) {
  logger.info("Starting UDP idle sockets test.");

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

  logger.info(
    `Testing ${config.idle_socket.sockets} idle sockets for ${config.duration_seconds} seconds.`,
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
    `Sockets received datagrams: ${sockets_received_datagrams}/${config.idle_socket.sockets}.`,
  );

  logger.info("Finished UDP idle sockets test.");
}

export async function launch_udp_latency_test(config: LatencyTestConfig) {
  const results_folder = await create_results_folder();

  await fs.mkdir(results_folder, { recursive: true });

  logger.info("Starting UDP latency test.");

  // const sockperf = launch_sockperf(config, results_folder, "udp");
  const sockperf = start_udp_latency(config);

  logger.info("Sockperf started.");

  // handleSigint(sockperf);

  await Promise.all([sockperf]);

  logger.info("Finished latency test.");
}

export async function launch_udp_bandwidth_test(
  config: UdpBandwidthTestConfig,
) {
  const results_folder = await create_results_folder();

  logger.info("Starting UDP bandwidth test.");

  // const sockperf = launch_sockperf(config, results_folder, "udp");

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

  handleSigint(
    iperf3,
    // sockperf
  );

  await Promise.all([
    iperf3.closed(),
    // sockperf.closed()
  ]);

  logger.info("Finished UDP bandwidth test.");
}

export async function launch_udp_open_sockets_test(
  config: UdpOpenSocketTestConfig,
) {
  logger.info("Starting UDP open sockets test.");

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

  let interval_id = setInterval(open_sockets, 1000);

  open_sockets();

  logger.info(
    `Opening ${config.open_socket.sockets_per_second} sockets per second for ${config.duration_seconds} seconds.`,
  );

  await sleep(config.duration_seconds);

  clearInterval(interval_id);

  sockets.forEach((socket) => {
    socket.close();
  });

  logger.info(`Opened sockets: ${socket_connected}`);
  logger.info(`Message sent: ${message_sent}`);
  logger.info(`Message received: ${message_received}`);

  logger.info("Finished UDP open sockets test.");
}

function start_udp_latency(config: ServerConfig & DurationConfig & EchoConfig) {
  const socket = dgram.createSocket("udp4");
  const max_sequence = config.duration_seconds * 100;
  const sequences_sent = new BigInt64Array(max_sequence);
  const sequences_received = new BigInt64Array(max_sequence);
  let sequence_counter = 0;
  let duplicated_messages = 0;
  let is_running = true;

  socket.on("message", (msg) => {
    const received_at = process.hrtime.bigint();
    const sequence = msg.readInt32BE();

    if (sequence >= max_sequence) {
      return;
    }

    if (!sequences_received[sequence]) {
      sequences_received[sequence] = received_at;
    } else {
      duplicated_messages++;
    }
  });

  const buffer = Buffer.allocUnsafe(4);

  const send_message = () => {
    if (is_running) {
      setTimeout(send_message, 9);
    }

    const sequence = sequence_counter++;

    buffer.writeInt32BE(sequence, 0);

    const sent_at = process.hrtime.bigint();

    socket.send(buffer, config.echo.port, config.server_ip);

    sequences_sent[sequence] = sent_at;
  };

  send_message();

  process.on("SIGINT", () => {
    socket.close();
  });

  return new Promise(async (res) => {
    await sleep(config.duration_seconds);

    is_running = false;

    await sleep(1);

    socket.close();

    let loss_responses = 0;
    let rtt = [];
    let total_rtt = 0;

    for (let seq = 0; seq < sequences_sent.length; seq++) {
      const sent_at = sequences_sent[seq] as bigint;
      const received_at = sequences_received[seq];

      if (received_at) {
        let duration = Number(received_at - sent_at) / 1e6;
        total_rtt += duration;
        rtt.push(duration);
      } else {
        loss_responses++;
      }
    }

    rtt.sort((a, b) => a - b);

    const get_percentile = (p: number) => {
      if (rtt.length === 0) return 0;

      return rtt[Math.max(0, Math.ceil((p / 100) * rtt.length) - 1)] as number;
    };

    const total_messages_sent = sequences_sent.length;
    const loss_rate = ((loss_responses / total_messages_sent) * 100).toFixed(2);

    logger.info(`===== Report =====`);
    logger.info(`Loss Messages:    ${loss_responses} (${loss_rate}%)`);
    logger.info(`Total Sent:       ${total_messages_sent}`);
    logger.info(`Total Received:   ${rtt.length}`);
    logger.info(`Total Duplicated: ${duplicated_messages}`);
    logger.info(`avg: ${(total_rtt / rtt.length).toFixed(3)} ms`);
    logger.info(`max: ${get_percentile(100).toFixed(3)} ms`);
    logger.info(`min: ${get_percentile(0).toFixed(3)} ms`);
    logger.info(`===== RTT Percentiles =====`);
    logger.info(`p99.999: ${get_percentile(99.999).toFixed(3)} ms`);
    logger.info(`p99.990: ${get_percentile(99.99).toFixed(3)} ms`);
    logger.info(`p99.900: ${get_percentile(99.9).toFixed(3)} ms`);
    logger.info(`p99.000: ${get_percentile(99).toFixed(3)} ms`);
    logger.info(`p95.000: ${get_percentile(95).toFixed(3)} ms`);
    logger.info(`p90.000: ${get_percentile(90).toFixed(3)} ms`);
    logger.info(`p75.000: ${get_percentile(75).toFixed(3)} ms`);
    logger.info(`p50.000: ${get_percentile(50).toFixed(3)} ms`);
    logger.info(`p25.000: ${get_percentile(25).toFixed(3)} ms`);

    res(undefined);
  });
}
