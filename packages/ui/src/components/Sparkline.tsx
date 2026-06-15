interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}

export function Sparkline({
  data,
  width = 60,
  height = 20,
  color = "var(--accent)",
  fill = false,
}: Props) {
  if (data.length < 2) {
    return <span style={{ width, height, display: "inline-block" }} />;
  }

  const max = Math.max(...data, 0.1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      style={{ display: "inline-block", verticalAlign: "middle", overflow: "visible" }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {fill && (
        <polygon
          points={`0,${height} ${pts} ${width},${height}`}
          fill={color}
          opacity={0.1}
        />
      )}
    </svg>
  );
}
