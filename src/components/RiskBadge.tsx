interface RiskBadgeProps {
  /** Raw health factor from the contract (e.g. 120 = HF 1.20, 95 = HF 0.95) */
  healthFactor: number;
  size?: "sm" | "md";
}

/**
 * Color-coded health factor badge with three zones:
 *   - Green  : HF >= 1.50 (Healthy)
 *   - Yellow : 1.00 <= HF < 1.50 (At Risk)
 *   - Red    : HF < 1.00 (Liquidatable)
 */
export const RiskBadge = ({ healthFactor, size = "md" }: RiskBadgeProps) => {
  const hf = healthFactor / 100;

  const zone: "healthy" | "warning" | "danger" =
    hf >= 1.5 ? "healthy" : hf >= 1.0 ? "warning" : "danger";

  const palette = {
    healthy: {
      bg: "rgba(16,185,129,0.10)",
      border: "rgba(16,185,129,0.22)",
      dot: "#10b981",
      text: "#10b981",
    },
    warning: {
      bg: "rgba(245,158,11,0.10)",
      border: "rgba(245,158,11,0.22)",
      dot: "#f59e0b",
      text: "#f59e0b",
    },
    danger: {
      bg: "rgba(244,63,94,0.10)",
      border: "rgba(244,63,94,0.22)",
      dot: "#f43f5e",
      text: "#f43f5e",
    },
  };

  const label =
    zone === "healthy" ? "Healthy" : zone === "warning" ? "At Risk" : "Liquidatable";

  const c = palette[zone];
  const fontSize = size === "sm" ? "10px" : "11.5px";
  const padding = size === "sm" ? "2px 8px" : "3px 11px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        borderRadius: "99px",
        fontSize,
        fontWeight: 600,
        padding,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: c.dot,
          flexShrink: 0,
        }}
      />
      HF {hf.toFixed(2)} · {label}
    </span>
  );
};
