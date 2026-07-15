import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { launch_server } from "./server.js";
import {
  launch_http_stress_test,
  launch_latency_test,
  launch_tcp_bandwidth_test,
  launch_tcp_connection_test,
} from "./client.js";

const argv = await yargs(hideBin(process.argv))
  .command("server", "Start the server", (yargs) => {
    return yargs.positional("port", {
      type: "number",
      describe: "port to bind on",
      default: 5000,
    });
  })
  .command("latency-test", "Test latency without stress testing.", (yargs) => {
    return yargs
      .positional("ip", {
        type: "string",
        describe: "IP of the server to test.",
        demandOption: true,
      })
      .positional("duration", {
        type: "number",
        describe: "Duration in seconds to stress test.",
        demandOption: true,
      })
      .positional("sockperf-port", {
        type: "number",
        describe: "Port of the sockperf server.",
        default: 11111,
      });
  })
  .command("http-test", "HTTP stress test with vegeta", (yargs) => {
    return yargs
      .positional("ip", {
        type: "string",
        describe: "IP of the server to test.",
        demandOption: true,
      })
      .positional("duration", {
        type: "number",
        describe: "Duration in seconds to stress test.",
        demandOption: true,
      })
      .positional("vegeta-max-workers", {
        type: "number",
        describe: "Vegeta -max-workers",
        default: 8,
      })
      .positional("nginx-port", {
        type: "number",
        describe: "Port of the nginx server.",
        default: 80,
      })
      .positional("sockperf-port", {
        type: "number",
        describe: "Port of the sockperf server.",
        default: 11111,
      });
  })
  .command("tcp-bandwidth-test", "TCP stress test with iperf3", (yargs) => {
    return yargs
      .positional("ip", {
        type: "string",
        describe: "IP of the server to test.",
        demandOption: true,
      })
      .positional("duration", {
        type: "number",
        describe: "Duration in seconds to stress test.",
        demandOption: true,
      })
      .positional("iperf3-parallelism", {
        type: "number",
        describe: "iperf3 -P",
        default: 16,
      })
      .positional("iperf3-port", {
        type: "number",
        describe: "Port of the iperf3 server.",
        default: 5201,
      })
      .positional("sockperf-port", {
        type: "number",
        describe: "Port of the sockperf server.",
        default: 11111,
      });
  })
  .command("tcp-connection-test", "TCP stress test with iperf3", (yargs) => {
    return yargs
      .positional("ip", {
        type: "string",
        describe: "IP of the server to test.",
        demandOption: true,
      })
      .positional("connections", {
        type: "number",
        describe: "Duration in seconds to stress test.",
        default: 100,
      });
  })
  .demandCommand(1, 'You must specify either "http-test" or "server".')
  .strict()
  .help()
  .parse();

const args = argv as any;

try {
  switch (args._[0]) {
    case "server":
      await launch_server();
      break;
    case "tcp-bandwidth-test":
      await launch_tcp_bandwidth_test({
        server_ip: args.ip,
        duration_seconds: args.duration,
        iperf3: {
          parallelism: args["iperf3-parallelism"],
          port: args["iperf3-port"],
        },
        sockperf: {
          port: args["sockperf-port"],
        },
      });
      break;
    case "tcp-connection-test":
      await launch_tcp_connection_test({
        server_ip: args.ip,
        tcp_echo: {
          connections: args["connections"],
          port: args["connections"],
        },
      });
      break;
    case "http-test":
      await launch_http_stress_test({
        server_ip: args.ip,
        duration_seconds: args.duration,
        vegeta: {
          max_workers: args["vegeta-max-workers"],
        },
        nginx: {
          port: args["nginx-port"],
        },
        sockperf: {
          port: args["sockperf-port"],
        },
      });
      break;
    case "latency-test":
      await launch_latency_test({
        server_ip: args.ip,
        duration_seconds: args.duration,
        sockperf: {
          port: args["sockperf-port"],
        },
      });
      break;
    default:
      break;
  }
} catch (e) {
  console.error(e);
}
