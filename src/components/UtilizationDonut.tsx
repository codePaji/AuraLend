interface UtilizationDonutProps {
  /** Utilization percentage, 0–100 */
  utilization: number;
  size?: number;
}

/**
 * SVG donut chart showing pool utilization with a dynamic color gradient:
 *   < 50%  → teal (healthy)
 *   50–80% → amber (moderate)
 *   > 80%  → rose (high pressure)
 */
export const UtilizationDonut = ({ utilization, size = 130 }: UtilizationDonutProps) => {
  const clamped = Math.min(Math.max(utilization, 0), 100);
  const r = size / 2 - 14;
  const circumference = 2 * Math.PI * r;
  const strokeDash = (clamped / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  const color =
    clamped < 50 ? "#5eead4" : clamped < 80 ? "#f59e0b" : "#f43f5e";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Track ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="11"
      />
      {/* Progress arc */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${strokeDash} ${circumference}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease" }}
      />
      {/* Centre text */}
      <text
        x={cx}
        y={cy - 5}
        textAnchor="middle"
        fill="#ffffff"
        fontSize="15"
        fontWeight="700"
        fontFamily="var(--font-display)"
      >
        {clamped.toFixed(1)}%
      </text>
      <text
        x={cx}
        y={cy + 13}
        textAnchor="middle"
        fill="rgba(255,255,255,0.35)"
        fontSize="9"
        fontFamily="var(--font-display)"
        letterSpacing="0.08em"
      >
        UTILIZED
      </text>
    </svg>
  );
};
