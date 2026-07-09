import { Process } from "./process.js";

export interface HttpStressTestConfig {
  ip: string;
  duration_seconds: number;
  sockperf: {
    port: number;
  };
}

export async function launch_http_stress_test(config: HttpStressTestConfig) {
  const sockperf = Process.spawn(
    "sockperf",
    "ping-pong",
    "--tcp",
    "-i",
    config.ip,
    "-p",
    `${config.sockperf.port}`,
    "-t",
    `${config.duration_seconds}`,
  );

  process.on("SIGINT", () => {
    sockperf.kill();
  });
}
