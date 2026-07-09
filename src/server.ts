import { Process } from "./process.js";

export async function launch_server() {
  console.log("Starting server");

  const nginx = Process.spawn("nginx", "-g", "daemon off;");
  const iperf3 = Process.spawn("iperf3", "-s", "-p", "5201");
  const sockperf = Process.spawn("sockperf", "server", "--tcp", "-p", "11111");

  process.on("SIGINT", () => {
    nginx.kill();
    iperf3.kill();
    sockperf.kill();
  });

  await Promise.all([nginx.closed(), iperf3.closed(), sockperf.closed()]);

  console.log("Closed server");
}
