import {
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
} from "chart.js";
import { Canvas } from "canvas";
import { writeFile, open } from "fs/promises";
import logger from "./logger.js";

Chart.register(
  CategoryScale,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
);

export async function create_pidstat_chart(
  pidstat_log_file: string,
  pidstat_graph_jpg_file: string,
) {
  const file = await open(pidstat_log_file);
  const memory: { time: string; bytes: number }[] = [];
  const cpu: { time: string; percentage: number }[] = [];

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
        memory.push({
          time: values[0],
          bytes: parseInt(values[6] as string) * 1024,
        });
        break;
      case 10: // CPU
        cpu.push({
          time: values[0],
          percentage: parseFloat(values[7] as string),
        });
        break;
    }
  }

  logger.info(`Creating chart`);

  const canvas = new Canvas(1200, 400);
  const chart = new Chart(canvas as any, {
    type: "line",
    data: {
      datasets: [
        {
          label: "CPU Usage",
          data: cpu.map((d) => ({ x: d.time, y: d.percentage })),
          borderColor: "#ff6384",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          yAxisID: "yCPU",
          tension: 0.3,
        },
        {
          label: "Memory Usage",
          data: memory.map((d) => ({ x: d.time, y: d.bytes })),
          borderColor: "#36a2eb",
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          yAxisID: "yMemory",
          tension: 0.3,
        },
      ],
    },
    options: {
      animation: false,
      responsive: false,
      scales: {
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

  logger.info(`Created chart`);
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
