// Tiny SVG bar sparkline used in KPI cards — matches SalesPulse reference design

interface MiniSparklineProps {
  data?: number[];
  color?: string;
  width?: number;
  height?: number;
}

const DEFAULT_DATA = [40, 55, 35, 60, 45, 70, 50];

export default function MiniSparkline({
  data = DEFAULT_DATA,
  color = '#22c55e',
  width = 64,
  height = 40,
}: MiniSparklineProps) {
  const barCount = data.length;
  const gap = 3;
  const barW = Math.floor((width - gap * (barCount - 1)) / barCount);
  const maxVal = Math.max(...data, 1);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {data.map((v, i) => {
        const barH = Math.max(4, Math.round((v / maxVal) * height));
        const x = i * (barW + gap);
        const y = height - barH;
        const opacity = 0.3 + (v / maxVal) * 0.5;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={2}
            fill={color}
            fillOpacity={opacity}
          />
        );
      })}
    </svg>
  );
}
