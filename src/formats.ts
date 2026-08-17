export function format_bytes(bytes: number) {
  if (bytes === 0) return "0 Bytes";

  const k = 1000;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function format_microseconds(microseconds: number) {
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
