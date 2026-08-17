import { readFile, open } from "fs/promises";
import type { TestClientOutputFiles } from "./test-client.js";
import type { TunnelOutputFiles } from "./tunnel.js";

interface SiffleLatency {
  min: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p99: number;
  p99_9: number;
  p99_99: number;
  max: number;
}

interface SiffleInterval {
  messages_sent: number;
  messages_received: number;
  latency: SiffleLatency;
}

interface SiffleResults {
  total: SiffleInterval;
  intervals: SiffleInterval[];
}

export async function load_siffle_data(
  test_client_output_files: TestClientOutputFiles,
) {
  return JSON.parse(
    (await readFile(test_client_output_files.siffle_stdout)).toString(),
  ) as SiffleResults;
}

interface VegetaResults {
  avg_requests_per_second: number;
  avg_p50: number;
  avg_p90: number;
  avg_p95: number;
  avg_p99: number;
  requests_per_second: number[];
  p50: number[];
  p90: number[];
  p95: number[];
  p99: number[];
}

export async function load_vegeta_data(
  test_client_output_files: TestClientOutputFiles,
) {
  const vegeta_file = await open(test_client_output_files.vegeta_stdout);
  const requests_per_second: number[] = [];
  const p50: number[] = [];
  const p90: number[] = [];
  const p95: number[] = [];
  const p99: number[] = [];
  let previous_requests = 0;

  for await (let line of vegeta_file.readLines()) {
    const interval = JSON.parse(line.substring(line.indexOf("{")));

    requests_per_second.push(interval.requests - previous_requests);
    previous_requests = interval.requests;

    p50.push(interval.latencies["50th"]);
    p90.push(interval.latencies["90th"]);
    p95.push(interval.latencies["95th"]);
    p99.push(interval.latencies["99th"]);
  }

  return {
    avg_p50: p50.reduce((sum, num) => sum + num, 0) / p50.length,
    avg_p90: p90.reduce((sum, num) => sum + num, 0) / p90.length,
    avg_p95: p95.reduce((sum, num) => sum + num, 0) / p95.length,
    avg_p99: p99.reduce((sum, num) => sum + num, 0) / p99.length,
    avg_requests_per_second: requests_per_second.reduce((sum, num) => sum + num, 0) / requests_per_second.length,
    p50,
    p90,
    p95,
    p99,
    requests_per_second,
  } satisfies VegetaResults;
}

interface PidstatResults {
  avg_cpu: number;
  avg_memory: number;
  cpu: number[];
  memory: number[];
}

export async function load_pidstat_data(
  tunnel_output_files: TunnelOutputFiles,
) {
  const pidstat_file = await open(tunnel_output_files.pidstat_stdout);
  const memory: number[] = [];
  const cpu: number[] = [];

  for await (let line of pidstat_file.readLines()) {
    line = line.trim();

    if (line.length === 0) {
      continue;
    }

    let values = line.match(/\S+/g) || [];

    if (values[1] === "UID") {
      continue;
    }

    switch (values.length) {
      case 9: // Memory in KiB
        memory.push(parseInt(values[6] as string) * 1024);
        break;
      case 10: // CPU
        cpu.push(parseFloat(values[7] as string));
        break;
    }
  }

  return {
    avg_cpu: cpu.reduce((sum, num) => sum + num, 0) / cpu.length,
    avg_memory: memory.reduce((sum, num) => sum + num, 0) / memory.length,
    cpu,
    memory,
  } satisfies PidstatResults;
}
