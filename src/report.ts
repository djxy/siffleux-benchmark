import { writeFile } from "fs/promises";
import {
  load_pidstat_data,
  load_siffle_data,
  load_vegeta_data,
} from "./exporters.js";
import { format_bytes, format_microseconds } from "./formats.js";
import type {
  DurationConfig,
  TestClientOutputFiles,
  TunnelConfig,
} from "./test-client.js";
import type { TunnelOutputFiles } from "./tunnel.js";

export async function create_siffle_report_summary(
  test_client_output_files: TestClientOutputFiles,
) {
  const siffle_json = await load_siffle_data(test_client_output_files);
  const min = format_microseconds(siffle_json.total.latency.min);
  const p25 = format_microseconds(siffle_json.total.latency.p25);
  const p50 = format_microseconds(siffle_json.total.latency.p50);
  const p75 = format_microseconds(siffle_json.total.latency.p75);
  const p90 = format_microseconds(siffle_json.total.latency.p90);
  const p99 = format_microseconds(siffle_json.total.latency.p99);
  const p99_9 = format_microseconds(siffle_json.total.latency.p99_9);
  const p99_99 = format_microseconds(siffle_json.total.latency.p99_99);
  const max = format_microseconds(siffle_json.total.latency.max);

  return `
### Siffle

TCP latency (RTT) percentiles recorded during the Siffle benchmark test.

#### Real-Time Latency (1s Intervals)

<img src="${remove_path(test_client_output_files.siffle_graph_jpg)}">

#### Latency Percentiles (Full Test)

| Min | p25 | p50 | p75 | p90 | p99 | p99.9 | p99.99 | Max |
| - | - | - | - | - | - | - | - | - |
| ${min} | ${p25} | ${p50} | ${p75} | ${p90} | ${p99} | ${p99_9} | ${p99_99} | ${max} |
  `;
}

export async function create_vegeta_report_summary(
  test_client_output_files: TestClientOutputFiles,
) {
  const vegeta = await load_vegeta_data(test_client_output_files);
  const avg_p50 = format_microseconds(vegeta.avg_p50 / 1000);
  const avg_p90 = format_microseconds(vegeta.avg_p90 / 1000);
  const avg_p95 = format_microseconds(vegeta.avg_p95 / 1000);
  const avg_p99 = format_microseconds(vegeta.avg_p99 / 1000);

  return `
### Vegeta

HTTP requests per second and HTTP latency (RTT) percentiles recorded during the Vegeta benchmark test.

#### Real-Time Requests Per Second & Latency (1s Intervals)

<img src="${remove_path(test_client_output_files.vegeta_graph_jpg)}">

#### Average Requests Per Second (Full Test)

| Avg. Requests Per Second |
| - |
| ${vegeta.avg_requests_per_second.toFixed(2)} |

#### Average HTTP Latency (Full Test)

| p50 | p90 | p95 | p99 |
| - | - | - | - |
| ${avg_p50} | ${avg_p90} | ${avg_p95} | ${avg_p99} |
  `;
}

export async function create_pidstat_report_summary(
  tunnel_output_files: TunnelOutputFiles,
  tunnel_id: string,
  tunnel_side: "client" | "server",
) {
  const pidstat = await load_pidstat_data(tunnel_output_files);

  return `
### Pidstat (${tunnel_id} ${tunnel_side})

Memory and CPU usages of ${tunnel_id} ${tunnel_side} recorded during the benchmark test.

#### Real-Time Usages (1s Intervals)

<img src="${remove_path(tunnel_output_files.pidstat_graph_jpg)}">

#### Average Usage (Full Test)

| Avg. CPU | Avg. Memory |
| - | - |
| ${pidstat.avg_cpu.toFixed(2)} % | ${format_bytes(pidstat.avg_memory)} |
  `;
}

export async function save_report(
  config: DurationConfig & TunnelConfig,
  summaries: Promise<string>[],
  test_client_output_files: TestClientOutputFiles,
) {
  let report = `
## Test

- **Tunnel**: \`${config.tunnel.id}\`
- **Duration**: \`${config.duration_seconds}s\`
- **Executed at**: \`${new Date().toISOString()}\`

${(await Promise.all(summaries))
  .map((s) => s.trim())
  .join("\n")
  .trim()}
`.trim();

  await writeFile(test_client_output_files.report, report);
}

function remove_path(path: string) {
  return `.${path.substring(path.lastIndexOf("/"))}`;
}
