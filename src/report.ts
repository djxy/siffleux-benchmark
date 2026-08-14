import { writeFile } from "fs/promises";
import { load_siffle_data } from "./exporters.js";
import { formatMicroseconds } from "./formats.js";

export async function siffle_summary(
  siffle_json_file: string,
  siffle_graph_jpg_file: string,
) {
  const siffle_json = await load_siffle_data(siffle_json_file);
  const min = formatMicroseconds(siffle_json.total.latency.min);
  const p25 = formatMicroseconds(siffle_json.total.latency.p25);
  const p50 = formatMicroseconds(siffle_json.total.latency.p50);
  const p75 = formatMicroseconds(siffle_json.total.latency.p75);
  const p90 = formatMicroseconds(siffle_json.total.latency.p90);
  const p99 = formatMicroseconds(siffle_json.total.latency.p99);
  const p99_9 = formatMicroseconds(siffle_json.total.latency.p99_9);
  const p99_99 = formatMicroseconds(siffle_json.total.latency.p99_99);
  const max = formatMicroseconds(siffle_json.total.latency.max);

  return `
  ### Siffle
  <img src="./${siffle_graph_jpg_file}">
  | Min | p25 | p50 | p75 | p90 | p99 | p99.9 | p99.99 | Max |
  | - | - | - | - | - | - | - | - | - |
  | ${min} | ${p25} | ${p50} | ${p75} | ${p90} | ${p99} | ${p99_9} | ${p99_99} | ${max} |
  `;
}

export async function save_report(
  summaries: Promise<string>[],
  report_file: string,
) {
  await writeFile(
    report_file,
    (await Promise.all(summaries))
      .map((s) => s.trim())
      .join("\n")
      .trim(),
  );
}
