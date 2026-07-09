import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { launch_server } from "./server.js";
import { launch_http_stress_test } from "./client.js";

const argv = await yargs(hideBin(process.argv))
  .command("server", "Start the server", (yargs) => {
    return yargs.positional("port", {
      type: "number",
      describe: "port to bind on",
      default: 5000,
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
      .positional("sockperf-port", {
        type: "number",
        describe: "Port of the sockperf server.",
        default: 11111,
      });
  })
  .demandCommand(1, 'You must specify either "http-test" or "server".')
  .strict()
  .help()
  .parse();

const args = argv as any;

switch (args._[0]) {
  case "server":
    await launch_server();
    break;
  case "http-test":
    console.log(args)
    await launch_http_stress_test({
      ip: args.ip,
      duration_seconds: args.duration,
      sockperf: {
        port: args['sockperf-port'],
      },
    });
    break;
  default:
    break;
}
