import Fastify from "fastify";
import { prepare_test_folder, Process, sleep } from "./process.js";
import { create_pidstat_chart } from "./charts.js";

export interface StartTunnelConfig {
  test_group: string;
  test_name: string;
  cmd: string;
  args: string[];
}

export interface Tunnel {
  test_file_prefix: string;
  pidstat_log_file: string;
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

    const tunnel: Tunnel = {
      processes: [],
      test_file_prefix: "",
      pidstat_log_file: "",
    };

    tunnels.set(tunnel_id, tunnel);

    const start_config = req.body as StartTunnelConfig;
    const test_file_prefix = await prepare_test_folder(
      start_config.test_group,
      start_config.test_name,
    );

    tunnel.test_file_prefix = test_file_prefix;

    const tunnel_process = Process.spawn({
      cmd: start_config.cmd,
      args: start_config.args,
      stderr_file: `${test_file_prefix}.err`,
      stdout_file: `${test_file_prefix}.log`,
    });

    tunnel.processes.push(tunnel_process);

    await sleep(0.5);

    tunnel.pidstat_log_file = `${test_file_prefix}-pidstat.log`;

    const pidstat_process = Process.spawn({
      cmd: "pidstat",
      args: ["-p", `${tunnel_process.pid()}`, "-u", "-r", "1"],
      stderr_file: `${test_file_prefix}-pidstat.err`,
      stdout_file: `${test_file_prefix}-pidstat.log`,
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

    await create_pidstat_chart(
      tunnel.pidstat_log_file,
      `${tunnel.test_file_prefix}-pidstat.jpeg`,
    );

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
