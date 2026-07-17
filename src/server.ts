import logger from "./logger.js";
import { Process } from "./process.js";
import net from "net";

export async function launch_server() {
  logger.info("Starting server");

  const nginx = Process.spawn({ cmd: "nginx", args: ["-g", "daemon off;"] });
  const iperf3 = Process.spawn({ cmd: "iperf3", args: ["-s", "-p", "5201"] });
  const sockperf = Process.spawn({
    cmd: "sockperf",
    args: ["server", "--tcp", "-p", "11111"],
  });
  const tcp_echo = new TcpEchoServer();

  await tcp_echo.start();

  logger.info("Nginx, iperf3, sockperf and tcp echo ready");

  process.on("SIGINT", () => {
    nginx.kill();
    iperf3.kill();
    sockperf.kill();
    tcp_echo.stop();
  });

  await Promise.all([nginx.closed(), iperf3.closed(), sockperf.closed()]);

  logger.info("Closed server");
}

class TcpEchoServer {
  #server: net.Server;

  constructor() {
    this.#server = net.createServer((socket) => {
      socket.on("data", (data) => {
        if (!socket.write(data)) {
          socket.pause();
        }
      });

      socket.on("drain", () => {
        socket.resume();
      });

      socket.on("error", () => {});
    });
  }

  start() {
    return new Promise((res) => {
      this.#server.listen(3001, "0.0.0.0", 2048, () => {
        res(undefined);
      });
    });
  }

  stop() {
    return new Promise((res) => {
      this.#server.close(() => {
        res(undefined);
      });
    });
  }
}
