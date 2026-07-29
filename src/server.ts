import logger from "./logger.js";
import { Process } from "./process.js";
import net from "net";
import dgram from "dgram";

export async function launch_server() {
  logger.info("Starting server");

  const nginx = Process.spawn({ cmd: "nginx", args: ["-g", "daemon off;"] });
  const iperf3 = Process.spawn({ cmd: "iperf3", args: ["-s", "-p", "5201"] });
  const sockperf_tcp = Process.spawn({
    cmd: "sockperf",
    args: ["server", "--tcp", "-p", "11111"],
  });
  const sockperf_udp = Process.spawn({
    cmd: "sockperf",
    args: ["server", "-p", "11111"],
  });
  const tcp_echo = new TcpEchoServer();
  const udp_echo = new UdpEchoServer();

  await tcp_echo.start();
  await udp_echo.start();

  logger.info("Nginx, iperf3, sockperf and TCP/UDP echo ready");

  process.on("SIGINT", () => {
    nginx.kill();
    iperf3.kill();
    sockperf_tcp.kill();
    sockperf_udp.kill();
    tcp_echo.stop();
    udp_echo.stop();
  });

  await Promise.all([
    nginx.closed(),
    iperf3.closed(),
    sockperf_tcp.closed(),
    sockperf_udp.closed(),
  ]);

  logger.info("Closed server");
}

class UdpEchoServer {
  #server: dgram.Socket;

  constructor() {
    this.#server = dgram.createSocket({
      type: "udp4",
      recvBufferSize: 4 * 1024 * 1024,
      sendBufferSize: 4 * 1024 * 1024,
    });

    this.#server.on("message", (data, remote_info) => {
      this.#server.send(data, remote_info.port, remote_info.address);
    });
  }
  start() {
    return new Promise((res) => {
      this.#server.bind(3001, "0.0.0.0", () => {
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
