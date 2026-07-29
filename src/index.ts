import yargs, { type Argv, type ArgumentsCamelCase } from "yargs";
import { hideBin } from "yargs/helpers";
import { launch_server } from "./server.js";
import {
  launch_http_stress_test,
  launch_tcp_latency_test,
  launch_tcp_bandwidth_test,
  launch_tcp_idle_socket_test,
  launch_udp_latency_test,
  launch_udp_bandwidth_test,
  launch_udp_idle_socket_test,
  type DurationConfig,
  type Iperf3Config,
  type Iperf3UDPConfig,
  type NginxConfig,
  type ServerConfig,
  type SockperfConfig,
  type EchoConfig,
  type VegetaConfig,
  type IdleSocketConfig,
} from "./client.js";
import logger from "./logger.js";

function set_server_options(argv: Argv) {
  return argv.option("ip", {
    type: "string",
    describe: "IP of the server to test.",
    demandOption: true,
  });
}

function set_duration_options(argv: Argv) {
  return argv.option("duration", {
    type: "number",
    describe: "Duration in seconds to test.",
    demandOption: true,
  });
}

function set_sockperf_options(argv: Argv) {
  return argv.option("sockperf-port", {
    type: "number",
    describe: "Port of the sockperf server.",
    default: 11111,
  });
}

function set_vegeta_options(argv: Argv) {
  return argv.option("vegeta-max-workers", {
    type: "number",
    describe: "Vegeta -max-workers",
    default: 8,
  });
}

function set_nginx_options(argv: Argv) {
  return argv.option("nginx-port", {
    type: "number",
    describe: "Port of the nginx server.",
    default: 80,
  });
}

function set_iperf3_options(argv: Argv) {
  return argv
    .option("iperf3-parallelism", {
      type: "number",
      describe: "iperf3 parallel streams (-P)",
      default: 8,
    })
    .option("iperf3-bandwidth", {
      type: "string",
      describe: "iperf3 bandwidth (-b)",
      default: "10m",
    })
    .option("iperf3-port", {
      type: "number",
      describe: "Port of the iperf3 server.",
      default: 5201,
    });
}

function set_iperf3_udp_options(argv: Argv) {
  return argv.option("iperf3-payload-size", {
    type: "number",
    describe: "iperf3 datagram payload size (-l)",
    default: 1200,
  });
}

function set_echo_options(argv: Argv) {
  return argv.option("echo-port", {
    type: "number",
    describe: "Port of the Echo server.",
    default: 5000,
  });
}

function set_idle_socket_options(argv: Argv) {
  return argv.option("idle-sockets", {
    type: "number",
    describe: "Number of concurrent idle sockets to open.",
    default: 100,
  });
}

const args_to_server_config = (args: ArgumentsCamelCase): ServerConfig => ({
  server_ip: args.ip as string,
});

const args_to_duration_config = (args: ArgumentsCamelCase): DurationConfig => ({
  duration_seconds: args.duration as number,
});

const args_to_iperf3_config = (args: ArgumentsCamelCase): Iperf3Config => ({
  iperf3: {
    parallelism: args["iperf3-parallelism"] as number,
    port: args["iperf3-port"] as number,
    bandwidth: args["iperf3-bandwidth"] as string,
  },
});

const args_to_iperf3_udp_config = (
  args: ArgumentsCamelCase,
): Iperf3UDPConfig => ({
  iperf3: {
    payload_size: args["iperf3-payload-size"] as number,
  },
});

const args_to_sockperf_config = (args: ArgumentsCamelCase): SockperfConfig => ({
  sockperf: {
    port: args["sockperf-port"] as number,
  },
});

const args_to_idle_socket_config = (
  args: ArgumentsCamelCase,
): IdleSocketConfig => ({
  idle_socket: {
    concurrent_sockets: args["idle-sockets"] as number,
  },
});

const args_to_echo_config = (args: ArgumentsCamelCase): EchoConfig => ({
  echo: {
    port: args["echo-port"] as number,
  },
});

const args_to_nginx_config = (args: ArgumentsCamelCase): NginxConfig => ({
  nginx: {
    port: args["nginx-port"] as number,
  },
});

const args_to_vegeta_config = (args: ArgumentsCamelCase): VegetaConfig => ({
  vegeta: {
    max_workers: args["vegeta-max-workers"] as number,
  },
});

await yargs(hideBin(process.argv))
  .scriptName("benchmark")
  .usage("$0 <command> [options]")
  .command("server", "Start the benchmark server daemon", async () => {
    try {
      await launch_server();
    } catch (err) {
      logger.error(err);
    }
  })
  .command("http <scenario>", "HTTP protocol benchmarks", (yargs_http) => {
    return yargs_http.command(
      "stress",
      "HTTP stress test using Vegeta",
      (y) =>
        set_sockperf_options(
          set_nginx_options(
            set_vegeta_options(set_duration_options(set_server_options(y))),
          ),
        ),
      async (argv) => {
        try {
          await launch_http_stress_test({
            ...args_to_server_config(argv),
            ...args_to_duration_config(argv),
            ...args_to_vegeta_config(argv),
            ...args_to_nginx_config(argv),
            ...args_to_sockperf_config(argv),
          });
        } catch (err) {
          logger.error(err);
        }
      },
    );
  })
  .command("tcp <scenario>", "TCP protocol benchmarks", (yargs_tcp) => {
    return yargs_tcp
      .command(
        "latency",
        "Measure round-trip latency using sockperf",
        (y) =>
          set_sockperf_options(set_duration_options(set_server_options(y))),
        async (argv) => {
          try {
            await launch_tcp_latency_test({
              ...args_to_server_config(argv),
              ...args_to_duration_config(argv),
              ...args_to_sockperf_config(argv),
            });
          } catch (err) {
            logger.error(err);
          }
        },
      )
      .command(
        "bandwidth",
        "Measure maximum TCP throughput using iperf3 and round-trip latency using sockperf",
        (y) =>
          set_sockperf_options(
            set_iperf3_options(set_duration_options(set_server_options(y))),
          ),
        async (argv) => {
          try {
            await launch_tcp_bandwidth_test({
              ...args_to_server_config(argv),
              ...args_to_duration_config(argv),
              ...args_to_iperf3_config(argv),
              ...args_to_sockperf_config(argv),
            });
          } catch (err) {
            logger.error(err);
          }
        },
      )
      .command(
        "idle-sockets",
        "Test long-lived TCP sockets sending 1 byte at interval of few seconds",
        (y) =>
          set_idle_socket_options(
            set_echo_options(set_duration_options(set_server_options(y))),
          ),
        async (argv) => {
          try {
            await launch_tcp_idle_socket_test({
              ...args_to_server_config(argv),
              ...args_to_duration_config(argv),
              ...args_to_echo_config(argv),
              ...args_to_idle_socket_config(argv),
            });
          } catch (err) {
            logger.error(err);
          }
        },
      )
      .demandCommand(1, "You must specify a TCP test.");
  })
  .command("udp <scenario>", "UDP protocol benchmarks", (yargs_tcp) => {
    return yargs_tcp
      .command(
        "latency",
        "Measure round-trip latency using sockperf",
        (y) =>
          set_sockperf_options(set_duration_options(set_server_options(y))),
        async (argv) => {
          try {
            await launch_udp_latency_test({
              ...args_to_server_config(argv),
              ...args_to_duration_config(argv),
              ...args_to_sockperf_config(argv),
            });
          } catch (err) {
            logger.error(err);
          }
        },
      )
      .command(
        "bandwidth",
        "Measure maximum UDP throughput using iperf3 and round-trip latency using sockperf",
        (y) =>
          set_sockperf_options(
            set_iperf3_options(
              set_iperf3_udp_options(
                set_duration_options(set_server_options(y)),
              ),
            ),
          ),
        async (argv) => {
          try {
            await launch_udp_bandwidth_test({
              ...args_to_server_config(argv),
              ...args_to_duration_config(argv),
              ...args_to_sockperf_config(argv),
              iperf3: {
                ...args_to_iperf3_config(argv).iperf3,
                ...args_to_iperf3_udp_config(argv).iperf3,
              },
            });
          } catch (err) {
            logger.error(err);
          }
        },
      )
      .command(
        "idle-sockets",
        "Test long-lived UDP sockets sending 1 byte at interval of few seconds",
        (y) =>
          set_idle_socket_options(
            set_echo_options(set_duration_options(set_server_options(y))),
          ),
        async (argv) => {
          try {
            await launch_udp_idle_socket_test({
              ...args_to_server_config(argv),
              ...args_to_duration_config(argv),
              ...args_to_echo_config(argv),
              ...args_to_idle_socket_config(argv),
            });
          } catch (err) {
            logger.error(err);
          }
        },
      )
      .demandCommand(1, "You must specify a UDP test.");
  })
  .demandCommand(1, "You must select a benchmark command to execute.")
  .strict()
  .alias("v", "version")
  .help()
  .alias("h", "help")
  .parse();
