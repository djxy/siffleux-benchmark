import Fastify from "fastify";
import { prepare_test_folder, Process, sleep } from "./process.js";
import { mkdir } from "fs/promises";

export interface StartTunnelConfig {
  test_group: string;
  test_name: string;
  cmd: string;
  args: string[];
}

export function launch_tunnel_manager() {
  const fastify = Fastify({
    logger: true,
  });

  const tunnels = new Map<string, Process[]>();

  fastify.post("/tunnels/:tunnel_id", async (req, rep) => {
    const { tunnel_id } = req.params as { tunnel_id: string };

    if (tunnels.has(tunnel_id)) {
      rep.status(400).send({ message: `Tunnel ${tunnel_id} already running.` });
      return;
    }

    const processes: Process[] = [];

    tunnels.set(tunnel_id, processes);

    const start_config = req.body as StartTunnelConfig;
    const test_file_prefix = await prepare_test_folder(
      start_config.test_group,
      start_config.test_name,
    );

    const tunnel_process = Process.spawn({
      cmd: start_config.cmd,
      args: start_config.args,
      stderr_file: `${test_file_prefix}.err`,
      stdout_file: `${test_file_prefix}.log`,
    });

    processes.push(tunnel_process);

    await sleep(0.5);

    const pidstat_process = Process.spawn({
      cmd: "pidstat",
      args: ["-p", `${tunnel_process.pid()}`, "-u", "-r", "1"],
      stderr_file: `${test_file_prefix}-pidstat.err`,
      stdout_file: `${test_file_prefix}-pidstat.log`,
    });

    processes.push(pidstat_process);
  });

  fastify.delete("/tunnels/:tunnel_id", async (req, rep) => {
    const { tunnel_id } = req.params as { tunnel_id: string };

    if (!tunnels.has(tunnel_id)) {
      rep.status(400).send({ message: `Tunnel ${tunnel_id} is not running.` });
      return;
    }

    const processes = tunnels.get(tunnel_id) as Process[];

    processes.forEach((p) => {
      p.kill();
    });

    await Promise.all(processes.map((p) => p.closed()));

    tunnels.delete(tunnel_id);

    rep.send();
  });

  fastify.listen({ port: 8080, host: "0.0.0.0" }, (err, _) => {
    if (err) throw err;

    process.on("SIGINT", () => {
      fastify.close();

      tunnels
        .values()
        .flatMap((p) => p)
        .forEach((p) => p.kill());
    });
  });
}
