import { readFile } from "fs/promises";

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

export async function load_siffle_data(siffle_json_file: string) {
  return JSON.parse((await readFile(siffle_json_file)).toString()) as SiffleResults;
}
