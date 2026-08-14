import {
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Legend,
  BarController,
  BarElement,
  type ChartConfiguration,
} from "chart.js";
import { Canvas } from "canvas";
import { writeFile, open, readFile } from "fs/promises";
import logger from "./logger.js";
import { load_siffle_data } from "./exporters.js";
import { formatBytes, formatMicroseconds } from "./formats.js";

Chart.register(
  CategoryScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Legend,
);

const PALETTE = {
  red: {
    border: "#ff6384",
    bg: "rgba(255, 99, 132, 1)",
    bgTranslucent: "rgba(255, 99, 132, 0.2)",
  },
  blue: {
    border: "#36a2eb",
    bg: "rgba(54, 162, 235, 1)",
    bgTranslucent: "rgba(54, 162, 235, 0.2)",
  },
  teal: {
    border: "#4bc0c0",
    bg: "rgba(75, 192, 192, 1)",
    bgTranslucent: "rgba(75, 192, 192, 0.2)",
  },
  purple: {
    border: "#9966ff",
    bg: "rgba(153, 102, 255, 1)",
    bgTranslucent: "rgba(153, 102, 255, 0.2)",
  },
  orange: {
    border: "#ff9f40",
    bg: "rgba(255, 159, 64, 1)",
    bgTranslucent: "rgba(255, 159, 64, 0.2)",
  },
  yellow: {
    border: "#ffce56",
    bg: "rgba(255, 206, 86, 1)",
    bgTranslucent: "rgba(255, 206, 86, 0.2)",
  },
};

const PERCENTILE_COLORS = {
  p50: PALETTE.red,
  p75: PALETTE.blue,
  p90: PALETTE.teal,
  p95: PALETTE.yellow,
  p99: PALETTE.purple,
};

const backgroundColorPlugin = {
  id: "bg-color",
  beforeDraw: (chart: Chart, _args: any, options: { color?: string }) => {
    const { ctx } = chart;
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = options.color || "#ffffff";
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

function getBaseChartOptions(titleText: string): any {
  return {
    animation: false,
    responsive: false,
    plugins: {
      legend: {
        position: "bottom",
      },
      title: {
        display: true,
        text: titleText,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Time (s)",
        },
        ticks: {
          callback: (value: any) => `${value + 1}s`,
        },
      },
    },
  };
}

/**
 * Handles chart initialization, rendering, canvas exporting, and memory cleanup.
 */
async function renderAndSaveChart(
  chartConfig: ChartConfiguration,
  outputPath: string,
  chartName: string,
  width = 1200,
  height = 400,
) {
  logger.info(`Creating ${chartName} chart...`);

  const canvas = new Canvas(width, height);
  chartConfig.plugins = [...(chartConfig.plugins || []), backgroundColorPlugin];

  const chart = new Chart(canvas as any, chartConfig);

  await writeFile(outputPath, canvas.createJPEGStream({ quality: 0.9 }));

  chart.destroy();
  logger.info(`Created ${chartName} chart`);
}

export async function create_siffle_chart(
  siffle_json_file: string,
  siffle_graph_jpg_file: string,
  protocol: "UDP" | "TCP",
) {
  const siffle_json = await load_siffle_data(siffle_json_file);
  const p50: number[] = [];
  const p75: number[] = [];
  const p90: number[] = [];
  const p99: number[] = [];

  (siffle_json.intervals as any[]).forEach((interval) => {
    p50.push(interval.latency.p50);
    p75.push(interval.latency.p75);
    p90.push(interval.latency.p90);
    p99.push(interval.latency.p99);
  });

  const baseOptions = getBaseChartOptions(
    `${protocol} Latency Percentiles | Siffle`,
  );

  await renderAndSaveChart(
    {
      type: "line",
      data: {
        labels: Array.from({ length: p50.length }, (_, i) => i),
        datasets: [
          {
            label: "p50",
            data: p50,
            borderColor: PERCENTILE_COLORS.p50.border,
            backgroundColor: PERCENTILE_COLORS.p50.bg,
          },
          {
            label: "p75",
            data: p75,
            borderColor: PERCENTILE_COLORS.p75.border,
            backgroundColor: PERCENTILE_COLORS.p75.bg,
          },
          {
            label: "p90",
            data: p90,
            borderColor: PERCENTILE_COLORS.p90.border,
            backgroundColor: PERCENTILE_COLORS.p90.bg,
          },
          {
            label: "p99",
            data: p99,
            borderColor: PERCENTILE_COLORS.p99.border,
            backgroundColor: PERCENTILE_COLORS.p99.bg,
          },
        ],
      },
      options: {
        ...baseOptions,
        scales: {
          ...baseOptions.scales,
          y: {
            title: {
              display: true,
              text: "Latency",
            },
            ticks: {
              callback: (value) => formatMicroseconds(value as number),
            },
          },
        },
      },
    },
    siffle_graph_jpg_file,
    "siffle",
  );
}

export async function create_iperf3_chart(
  iperf3_json_file: string,
  iperf3_graph_jpg_file: string,
  protocol: "UDP" | "TCP",
) {
  const iperf3_json = JSON.parse((await readFile(iperf3_json_file)).toString());
  const upload_intervals = [0];
  const download_intervals = [0];
  const intervals = iperf3_json.intervals as any[];

  intervals.forEach((interval) => {
    upload_intervals.push(interval.sum.bytes);
    download_intervals.push(interval.sum_bidir_reverse.bytes);
  });

  const baseOptions = getBaseChartOptions(`${protocol} Bandwidth | iPerf3`);

  await renderAndSaveChart(
    {
      type: "line",
      data: {
        labels: Array.from({ length: upload_intervals.length }, (_, i) => i),
        datasets: [
          {
            label: "Upload",
            data: upload_intervals,
            borderColor: PALETTE.red.border,
            backgroundColor: PALETTE.red.bg,
          },
          {
            label: "Download",
            data: download_intervals,
            borderColor: PALETTE.blue.border,
            backgroundColor: PALETTE.blue.bg,
          },
        ],
      },
      options: {
        ...baseOptions,
        scales: {
          ...baseOptions.scales,
          y: {
            title: {
              display: true,
              text: "Bandwidth",
            },
            ticks: {
              callback: (value) => formatBytes(value as number),
            },
          },
        },
      },
    },
    iperf3_graph_jpg_file,
    "iperf3",
  );
}

export async function create_pidstat_chart(
  pidstat_log_file: string,
  pidstat_graph_jpg_file: string,
) {
  const file = await open(pidstat_log_file);
  const memory: number[] = [];
  const cpu: number[] = [];

  for await (let line of file.readLines()) {
    line = line.trim();

    if (line.length === 0) {
      continue;
    }

    let values = line.match(/\S+/g) || [];

    if (values[1] === "UID") {
      continue;
    }

    switch (values.length) {
      case 9: // Memory
        memory.push(parseInt(values[6] as string) * 1024);
        break;
      case 10: // CPU
        cpu.push(parseFloat(values[7] as string));
        break;
    }
  }

  const baseOptions = getBaseChartOptions("CPU & Memory Usage | Pidstat");

  await renderAndSaveChart(
    {
      type: "line",
      data: {
        labels: Array.from({ length: cpu.length }, (_, i) => i),
        datasets: [
          {
            label: "CPU Usage",
            data: cpu,
            borderColor: PALETTE.red.border,
            backgroundColor: PALETTE.red.bg,
            yAxisID: "yCPU",
          },
          {
            label: "Memory Usage",
            data: memory,
            borderColor: PALETTE.blue.border,
            backgroundColor: PALETTE.blue.bg,
            yAxisID: "yMemory",
          },
        ],
      },
      options: {
        ...baseOptions,
        scales: {
          ...baseOptions.scales,
          yCPU: {
            type: "linear",
            position: "left",
            min: 0,
            title: {
              display: true,
              text: "CPU Usage",
              color: PALETTE.red.border,
              font: { weight: "bold" },
            },
            ticks: {
              callback: (value) => `${value}%`,
            },
          },
          yMemory: {
            type: "linear",
            position: "right",
            min: 0,
            title: {
              display: true,
              text: "Memory Usage",
              color: PALETTE.blue.border,
              font: { weight: "bold" },
            },
            ticks: {
              callback: (value) => formatBytes(value as number),
            },
          },
        },
      },
    },
    pidstat_graph_jpg_file,
    "pidstat",
  );
}

export async function create_vegeta_chart(
  vegeta_ndjson_file: string,
  vegeta_graph_jpg_file: string,
) {
  const vegeta_file = await open(vegeta_ndjson_file);
  const requests_per_interval: number[] = [];
  const p50: number[] = [];
  const p90: number[] = [];
  const p95: number[] = [];
  const p99: number[] = [];
  let previous_requests = 0;

  for await (let line of vegeta_file.readLines()) {
    const interval = JSON.parse(line.substring(line.indexOf("{")));

    requests_per_interval.push(interval.requests - previous_requests);
    previous_requests = interval.requests;

    p50.push(interval.latencies["50th"]);
    p90.push(interval.latencies["90th"]);
    p95.push(interval.latencies["95th"]);
    p99.push(interval.latencies["99th"]);
  }

  const baseOptions = getBaseChartOptions("HTTP Throughput & Latency | Vegeta");

  await renderAndSaveChart(
    {
      type: "line",
      data: {
        labels: Array.from({ length: p50.length }, (_, i) => i),
        datasets: [
          {
            label: "p50",
            data: p50,
            backgroundColor: PERCENTILE_COLORS.p50.bg,
            borderColor: PERCENTILE_COLORS.p50.border,
            yAxisID: "yLatency",
          },
          {
            label: "p90",
            data: p90,
            backgroundColor: PERCENTILE_COLORS.p90.bg,
            borderColor: PERCENTILE_COLORS.p90.border,
            yAxisID: "yLatency",
          },
          {
            label: "p95",
            data: p95,
            backgroundColor: PERCENTILE_COLORS.p95.bg,
            borderColor: PERCENTILE_COLORS.p95.border,
            yAxisID: "yLatency",
          },
          {
            label: "p99",
            data: p99,
            backgroundColor: PERCENTILE_COLORS.p99.bg,
            borderColor: PERCENTILE_COLORS.p99.border,
            yAxisID: "yLatency",
          },
          {
            type: "bar",
            label: "Requests / sec",
            data: requests_per_interval,
            backgroundColor: PALETTE.orange.bgTranslucent,
            borderColor: PALETTE.orange.border,
            yAxisID: "yRequests",
          },
        ],
      },
      options: {
        ...baseOptions,
        scales: {
          ...baseOptions.scales,
          yLatency: {
            title: {
              display: true,
              text: "Latency",
            },
            ticks: {
              callback: (value) => formatMicroseconds((value as number) / 1000),
            },
          },
          yRequests: {
            type: "linear",
            position: "right",
            min: 0,
            title: {
              display: true,
              text: "Requests / sec",
              color: PALETTE.orange.border,
              font: { weight: "bold" },
            },
            ticks: {
              callback: (value) => `${value} req/s`,
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      },
    },
    vegeta_graph_jpg_file,
    "vegeta",
  );
}
