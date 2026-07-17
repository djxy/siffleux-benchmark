import yargs, { type Argv, type ArgumentsCamelCase } from "yargs";
import { hideBin } from "yargs/helpers";
import { launch_server } from "./server.js";
import {
  launch_http_stress_test,
  launch_latency_test,
  launch_tcp_bandwidth_test,
  launch_tcp_idle_connection_test,
  launch_tcp_open_connection_test,
  type DurationConfig,
  type Iperf3Config,
  type NginxConfig,
  type ServerConfig,
  type SockperfConfig,
  type TcpEchoConfig,
  type VegetaConfig,
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

function set_tcp_echo_options(argv: Argv) {
  return argv
    .option("connections", {
      type: "number",
      describe: "Number of concurrent connections.",
      default: 100,
    })
    .option("tcp-echo-port", {
      type: "number",
      describe: "Port of the TCP Echo server.",
      default: 5000,
    });
}

function set_iperf3_options(argv: Argv) {
  return argv
    .option("iperf3-parallelism", {
      type: "number",
      describe: "iperf3 parallel streams (-P)",
      default: 8,
    })
    .option("iperf3-port", {
      type: "number",
      describe: "Port of the iperf3 server.",
      default: 5201,
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
  },
});

const args_to_sockperf_config = (args: ArgumentsCamelCase): SockperfConfig => ({
  sockperf: {
    port: args["sockperf-port"] as number,
  },
});

const args_to_tcp_echo_config = (args: ArgumentsCamelCase): TcpEchoConfig => ({
  tcp_echo: {
    connections: args["connections"] as number,
    port: args["tcp-echo-port"] as number,
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
        (y) => set_sockperf_options(set_duration_options(set_server_options(y))),
        async (argv) => {
          try {
            await launch_latency_test({
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
        "Measure maximum TCP throughput using iperf3",
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
        "concurrency",
        "Test concurrent connection handling (open and close)",
        (y) => set_tcp_echo_options(set_server_options(y)),
        async (argv) => {
          try {
            await launch_tcp_open_connection_test({
              ...args_to_server_config(argv),
              ...args_to_tcp_echo_config(argv),
            });
          } catch (err) {
            logger.error(err);
          }
        },
      )
      .command(
        "idle",
        "Test long-lived idle connections",
        (y) =>
          set_tcp_echo_options(set_duration_options(set_server_options(y))),
        async (argv) => {
          try {
            await launch_tcp_idle_connection_test({
              ...args_to_server_config(argv),
              ...args_to_duration_config(argv),
              ...args_to_tcp_echo_config(argv),
            });
          } catch (err) {
            logger.error(err);
          }
        },
      )
      .demandCommand(
        1,
        "You must specify a TCP test.",
      );
  })
  .demandCommand(1, "You must select a benchmark command to execute.")
  .strict()
  .alias("v", "version")
  .help()
  .alias("h", "help")
  .parse();
