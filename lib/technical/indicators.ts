import type { PriceBar } from "@/lib/market-data/history";

export type TechnicalMetrics = ReturnType<typeof calculateTechnicalIndicators>;

export function calculateTechnicalIndicators(bars: PriceBar[]) {
  const closes = bars.map((bar) => bar.adjustedClose);
  const volumes = bars.map((bar) => bar.volume);
  const current = bars.at(-1) ?? null;
  const high52 = bars.length >= 200 ? Math.max(...bars.slice(-252).map((bar) => bar.high)) : null;
  const low52 = bars.length >= 200 ? Math.min(...bars.slice(-252).map((bar) => bar.low)) : null;
  return {
    currentClose: current?.adjustedClose ?? null,
    ma20: averageLast(closes, 20),
    ma50: averageLast(closes, 50),
    ma200: averageLast(closes, 200),
    rsi14: rsi(closes, 14),
    volatility20: volatility(closes, 20),
    volatility60: volatility(closes, 60),
    maxDrawdown: maxDrawdown(closes),
    high52Week: high52,
    low52Week: low52,
    distanceFrom52WeekHigh: current && high52 ? ((current.adjustedClose - high52) / high52) * 100 : null,
    averageVolume20: averageLast(volumes, 20),
    volumeMultiple: current && averageLast(volumes, 20) ? current.volume / (averageLast(volumes, 20) ?? 1) : null,
    return20: periodReturn(closes, 20),
    return60: periodReturn(closes, 60),
    return200: periodReturn(closes, 200)
  };
}

function averageLast(values: number[], count: number) {
  if (values.length < count) return null;
  const selected = values.slice(-count);
  return round(selected.reduce((sum, value) => sum + value, 0) / count);
}

function periodReturn(values: number[], days: number) {
  if (values.length <= days) return null;
  const start = values[values.length - days - 1];
  const end = values.at(-1);
  if (!start || !end) return null;
  return round(((end - start) / start) * 100);
}

function rsi(values: number[], period: number) {
  if (values.length <= period) return null;
  const changes = values.slice(1).map((value, index) => value - values[index]).slice(-period);
  const gains = changes.filter((change) => change > 0).reduce((sum, value) => sum + value, 0) / period;
  const losses = Math.abs(changes.filter((change) => change < 0).reduce((sum, value) => sum + value, 0) / period);
  if (losses === 0) return 100;
  return round(100 - 100 / (1 + gains / losses));
}

function volatility(values: number[], days: number) {
  if (values.length <= days) return null;
  const returns = values.slice(-days - 1).slice(1).map((value, index, arr) => {
    const previous = index === 0 ? values[values.length - days - 1] : arr[index - 1];
    return previous ? Math.log(value / previous) : 0;
  });
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / returns.length;
  return round(Math.sqrt(variance) * Math.sqrt(252) * 100);
}

function maxDrawdown(values: number[]) {
  if (values.length < 20) return null;
  let peak = values[0];
  let drawdown = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    drawdown = Math.min(drawdown, ((value - peak) / peak) * 100);
  }
  return round(drawdown);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
