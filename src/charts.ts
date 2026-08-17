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
import {
  load_pidstat_data,
  load_siffle_data,
  load_vegeta_data,
} from "./exporters.js";
import { format_bytes, format_microseconds } from "./formats.js";
import type { TunnelOutputFiles } from "./tunnel.js";
import type { TestClientOutputFiles } from "./test-client.js";

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

async function renderAndSaveChart(
  chart_config: ChartConfiguration,
  output_path: string,
  width = 1200,
  height = 400,
) {
  logger.info(
    `Creating ${chart_config.options?.plugins?.title?.text} chart...`,
  );

  const canvas = new Canvas(width, height);
  chart_config.plugins = [
    ...(chart_config.plugins || []),
    backgroundColorPlugin,
  ];

  const chart = new Chart(canvas as any, chart_config);

  await writeFile(output_path, canvas.createJPEGStream({ quality: 0.9 }));

  chart.destroy();
  logger.info(`Created ${chart_config.options?.plugins?.title?.text} chart`);
}

export async function create_siffle_chart(
  test_client_output_files: TestClientOutputFiles,
  protocol: "UDP" | "TCP",
) {
  const siffle_json = await load_siffle_data(test_client_output_files);
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
              callback: (value) => format_microseconds(value as number),
            },
          },
        },
      },
    },
    test_client_output_files.siffle_graph_jpg,
  );
}

export async function create_iperf3_chart(
  test_client_output_files: TestClientOutputFiles,
  protocol: "UDP" | "TCP",
) {
  const iperf3_json = JSON.parse(
    (await readFile(test_client_output_files.iperf3_stdout)).toString(),
  );
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
              callback: (value) => format_bytes(value as number),
            },
          },
        },
      },
    },
    test_client_output_files.iperf3_graph_jpeg,
  );
}

export async function create_pidstat_chart(
  tunnel_output_files: TunnelOutputFiles,
) {
  const { cpu, memory } = await load_pidstat_data(tunnel_output_files);
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
              text: "CPU",
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
              text: "Memory",
              color: PALETTE.blue.border,
              font: { weight: "bold" },
            },
            ticks: {
              callback: (value) => format_bytes(value as number),
            },
          },
        },
      },
    },
    tunnel_output_files.pidstat_graph_jpg,
  );
}

export async function create_vegeta_chart(
  test_client_output_files: TestClientOutputFiles,
) {
  const { p50, p90, p95, p99, requests_per_second } = await load_vegeta_data(
    test_client_output_files,
  );
  const baseOptions = getBaseChartOptions(
    "HTTP Requests Per Second & Latency | Vegeta",
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
            data: requests_per_second,
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
              callback: (value) => format_microseconds((value as number) / 1000),
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
    test_client_output_files.vegeta_graph_jpg,
  );
}
