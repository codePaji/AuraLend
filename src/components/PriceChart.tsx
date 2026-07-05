import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries } from "lightweight-charts";

const COL = {
  up: "rgb(16, 185, 129)",     // Emerald-500
  down: "rgb(244, 63, 94)",     // Rose-500
  text: "rgb(156, 163, 175)",   // Gray-400
  grid: "rgba(255, 255, 255, 0.04)",
};

function seed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCandles(feed: string, price: number, n = 100) {
  const r = rng(seed(feed));
  const closes: number[] = [1];
  for (let i = 1; i < n; i++) closes.push(closes[i - 1] * (1 + (r() - 0.5) * 0.015));
  const factor = price / closes[n - 1];
  const start = Math.floor(Date.now() / 1000) - n * 300;
  return closes.map((c, i) => {
    const close = c * factor;
    const open = (i === 0 ? c : closes[i - 1]) * factor;
    const hi = Math.max(open, close) * (1 + r() * 0.005);
    const lo = Math.min(open, close) * (1 - r() * 0.005);
    return { time: (start + i * 300) as any, open, high: hi, low: lo, close };
  });
}

export function PriceChart({ feed, price, decimals = 2 }: { feed: string; price: number; decimals?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const lastRef = useRef<any>(null);
  const [chartError, setChartError] = useState<string>("");

  useEffect(() => {
    if (!ref.current || price <= 0) return;

    let chart: any = null;
    try {
      chart = createChart(ref.current, {
        autoSize: true,
        layout: { background: { color: "transparent" }, textColor: COL.text, fontFamily: "var(--font-mono)" },
        grid: { vertLines: { color: COL.grid }, horzLines: { color: COL.grid } },
        rightPriceScale: { borderColor: "transparent" },
        timeScale: { borderColor: "transparent", timeVisible: true, secondsVisible: false },
        crosshair: { mode: 0 },
      });
      
      // Lightweight Charts v5.x unified series construction API
      const series = chart.addSeries(CandlestickSeries, {
        upColor: COL.up,
        downColor: COL.down,
        borderUpColor: COL.up,
        borderDownColor: COL.down,
        wickUpColor: COL.up,
        wickDownColor: COL.down,
        priceFormat: { type: "price", precision: decimals, minMove: 1 / 10 ** decimals },
      });
      
      const data = buildCandles(feed, price);
      series.setData(data);
      lastRef.current = data[data.length - 1];
      chart.timeScale().fitContent();
      chartRef.current = chart;
      seriesRef.current = series;
    } catch (err: any) {
      console.error("Failed to construct Lightweight Chart:", err);
      setChartError(err.message || err.toString());
    }
    
    return () => {
      if (chart) {
        try {
          chart.remove();
        } catch (e) {
          // Silent cleanup
        }
      }
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [feed]);

  useEffect(() => {
    const s = seriesRef.current;
    const last = lastRef.current;
    if (!s || !last || price <= 0) return;
    try {
      const updated = {
        ...last,
        close: price,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
      };
      lastRef.current = updated;
      s.update(updated);
    } catch (e) {
      // Silent updates
    }
  }, [price]);

  if (chartError) {
    return (
      <div style={{
        display: "flex",
        height: "100%",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        color: "var(--danger)",
        background: "rgba(244, 63, 94, 0.05)",
        borderRadius: "8px",
        padding: "16px",
        border: "1px dashed rgba(244, 63, 94, 0.2)"
      }}>
        Chart Loading Blocked: {chartError}
      </div>
    );
  }

  return <div ref={ref} className="chart-container" style={{ height: "100%", width: "100%" }} />;
}
