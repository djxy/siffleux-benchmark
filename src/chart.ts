import {
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Legend
} from "chart.js";
import { Canvas } from "canvas";
import { writeFile, open, readFile } from "fs/promises";
import logger from "./logger.js";

Chart.register(
  CategoryScale,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Legend
);

export async function create_siffle_chart(
  siffle_json_file: string,
  siffle_graph_jpg_file: string,
) {
  const siffle_json = JSON.parse((await readFile(siffle_json_file)).toString());
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

  logger.info("Creating siffle chart.");

  const canvas = new Canvas(1200, 400);
  const chart = new Chart(canvas as any, {
    type: "line",
    data: {
      labels: Array.from({ length: p50.length }, (_, i) => i),
      datasets: [
        {
          label: "p50",
          data: p50,
          borderColor: "#ff6384",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
        },
        {
          label: "p75",
          data: p75,
          borderColor: "#36a2eb",
          backgroundColor: "rgba(54, 162, 235, 0.2)",
        },
        {
          label: "p90",
          data: p90,
          borderColor: "#4bc0c0",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
        },
        {
          label: "p99",
          data: p99,
          borderColor: "#9966ff",
          backgroundColor: "rgba(153, 102, 255, 0.2)",
        },
      ],
    },
    options: {
      animation: false,
      responsive: false,
      plugins: {
        legend: {
          position: "bottom",
        },
        title: {
          display: true,
          text: "Latency Percentiles | Siffle",
        },
      },
      scales: {
        x: {
          ticks: {
            callback: (value) => `${value}s`,
          },
        },
        y: {
          ticks: {
            callback: (value) => formatMicroseconds(value as number),
          },
        },
      },
    },
    plugins: [
      {
        id: "bg-color",
        beforeDraw: (chart, args, options) => {
          const { ctx } = chart;
          ctx.save();
          ctx.globalCompositeOperation = "destination-over";
          ctx.fillStyle = options.color || "#ffffff";
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        },
      },
    ],
  });

  await writeFile(
    siffle_graph_jpg_file,
    canvas.createJPEGStream({ quality: 0.9 }),
  );

  chart.destroy();

  logger.info(`Created siffle chart`);
}

export async function create_iperf3_chart(
  iperf3_json_file: string,
  iperf3_graph_jpg_file: string,
) {
  const iperf3_json = JSON.parse((await readFile(iperf3_json_file)).toString());
  const upload_intervals = [0];
  const download_intervals = [0];
  const intervals = iperf3_json.intervals as any[];

  intervals.forEach((interval) => {
    upload_intervals.push(interval.sum.bytes);
    download_intervals.push(interval.sum_bidir_reverse.bytes);
  });

  logger.info("Creating iperf3 chart.");

  const canvas = new Canvas(1200, 400);
  const chart = new Chart(canvas as any, {
    type: "line",
    data: {
      labels: Array.from({ length: upload_intervals.length }, (_, i) => i),
      datasets: [
        {
          label: "Upload",
          data: upload_intervals,
          borderColor: "#ff6384",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
        },
        {
          label: "Download",
          data: download_intervals,
          borderColor: "#36a2eb",
          backgroundColor: "rgba(54, 162, 235, 0.2)",
        },
      ],
    },
    options: {
      animation: false,
      responsive: false,
      plugins: {
        legend: {
          position: "bottom",
        },
        title: {
          display: true,
          text: "Bandwidth | Iperf3",
        },
      },
      scales: {
        x: {
          ticks: {
            callback: (value) => `${value}s`,
          },
        },
        y: {
          ticks: {
            callback: (value) => formatBytes(value as number),
          },
        },
      },
    },
    plugins: [
      {
        id: "bg-color",
        beforeDraw: (chart, args, options) => {
          const { ctx } = chart;
          ctx.save();
          ctx.globalCompositeOperation = "destination-over";
          ctx.fillStyle = options.color || "#ffffff";
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        },
      },
    ],
  });

  await writeFile(
    iperf3_graph_jpg_file,
    canvas.createJPEGStream({ quality: 0.9 }),
  );

  chart.destroy();

  logger.info(`Created iperf3 chart`);
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

  logger.info(`Creating pidstat chart`);

  const canvas = new Canvas(1200, 400);
  const chart = new Chart(canvas as any, {
    type: "line",
    data: {
      labels: Array.from({ length: cpu.length }, (_, i) => i),
      datasets: [
        {
          label: "CPU Usage",
          data: cpu,
          borderColor: "#ff6384",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          yAxisID: "yCPU",
        },
        {
          label: "Memory Usage",
          data: memory,
          borderColor: "#36a2eb",
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          yAxisID: "yMemory",
        },
      ],
    },
    options: {
      animation: false,
      responsive: false,
      plugins: {
        legend: {
          position: "bottom",
        },
        title: {
          display: true,
          text: "Resources | Pidstat",
        },
      },
      scales: {
        x: {
          ticks: {
            callback: (value) => `${value}s`,
          },
        },
        yCPU: {
          type: "linear",
          position: "left",
          min: 0,
          title: {
            display: true,
            text: "CPU Usage",
            color: "#ff6384",
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
            color: "#36a2eb",
            font: { weight: "bold" },
          },
          ticks: {
            callback: (value) => formatBytes(value as number),
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
    plugins: [
      {
        id: "bg-color",
        beforeDraw: (chart, args, options) => {
          const { ctx } = chart;
          ctx.save();
          ctx.globalCompositeOperation = "destination-over";
          ctx.fillStyle = options.color || "#ffffff";
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        },
      },
    ],
  });

  await writeFile(
    pidstat_graph_jpg_file,
    canvas.createJPEGStream({ quality: 0.9 }),
  );

  chart.destroy();

  logger.info(`Created pidstat chart`);
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 Bytes";

  const k = 1000;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatMicroseconds(microseconds: number) {
  if (microseconds < 0) return "0µs";
  if (microseconds < 1000) return `${microseconds}µs`;

  const units = [
    { label: "s", value: 1000000 },
    { label: "ms", value: 1000 },
    { label: "µs", value: 1 },
  ];

  const parts = [];
  let remaining = microseconds;

  for (const { label, value } of units) {
    if (remaining >= value) {
      const count = Math.floor(remaining / value);
      remaining %= value;
      parts.push(`${count}${label}`);
    }
  }

  return parts.slice(0, 2).join(" ");
}
