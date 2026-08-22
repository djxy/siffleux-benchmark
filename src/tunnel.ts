import Fastify from "fastify";
import { Process, sleep_ms, sleep_seconds } from "./process.js";
import { create_pidstat_chart } from "./charts.js";

export interface TunnelOutputFiles {
  tunnel_stdout: string;
  tunnel_stderr: string;
  pidstat_stdout: string;
  pidstat_stderr: string;
  pidstat_graph_jpg: string;
}

export interface StartTunnelConfig {
  output_files: TunnelOutputFiles;
  cmd: string;
  args: string[];
}

export interface Tunnel {
  config: StartTunnelConfig;
  processes: Process[];
}

export function launch_tunnel_manager() {
  const fastify = Fastify({
    logger: true,
  });

  const tunnels = new Map<string, Tunnel>();

  fastify.post("/tunnels/:tunnel_id", async (req, rep) => {
    const { tunnel_id } = req.params as { tunnel_id: string };

    if (tunnels.has(tunnel_id)) {
      rep.status(400).send({ message: `Tunnel ${tunnel_id} already running.` });
      return;
    }

    const config = req.body as StartTunnelConfig;

    const tunnel: Tunnel = {
      processes: [],
      config,
    };

    tunnels.set(tunnel_id, tunnel);

    const tunnel_process = Process.spawn({
      cmd: config.cmd,
      args: config.args,
      stderr_file: config.output_files.tunnel_stderr,
      stdout_file: config.output_files.tunnel_stdout,
    });

    tunnel.processes.push(tunnel_process);

    while (typeof tunnel_process.pid() !== 'number') {
      await sleep_ms(5);
    }

    const pidstat_process = Process.spawn({
      cmd: "pidstat",
      args: ["-p", `${tunnel_process.pid()}`, "-u", "-r", "1"],
      stderr_file: config.output_files.pidstat_stderr,
      stdout_file: config.output_files.pidstat_stdout,
    });

    tunnel.processes.push(pidstat_process);
  });

  fastify.delete("/tunnels/:tunnel_id", async (req, rep) => {
    const { tunnel_id } = req.params as { tunnel_id: string };

    if (!tunnels.has(tunnel_id)) {
      rep.status(400).send({ message: `Tunnel ${tunnel_id} is not running.` });
      return;
    }

    const tunnel = tunnels.get(tunnel_id) as Tunnel;

    tunnel.processes.forEach((p) => {
      p.kill();
    });

    await Promise.all(tunnel.processes.map((p) => p.closed()));

    tunnels.delete(tunnel_id);

    await create_pidstat_chart(tunnel.config.output_files);

    rep.send();
  });

  fastify.listen({ port: 8080, host: "0.0.0.0" }, (err, _) => {
    if (err) throw err;

    process.on("SIGINT", () => {
      fastify.close();

      tunnels
        .values()
        .flatMap((t) => t.processes)
        .forEach((p) => p.kill());
    });
  });
}
