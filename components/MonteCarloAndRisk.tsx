"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Gauge, RefreshCw, ShieldAlert } from "lucide-react";

const farsiDigits = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];

const toPersianDigits = (num: number | string) =>
  num.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x, 10)]);

const formatNumber = (num: number, decimals = 0) => {
  if (!isFinite(num)) return "—";
  const v = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(num);
  return toPersianDigits(v);
};

function percentile(arr: number[], p: number) {
  if (!arr.length) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
}
function std(arr: number[]) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
}

function npv(cashflows: number[], rate: number) {
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

// Gaussian random using Box-Muller
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function buildHistogram(values: number[], bins = 24) {
  if (!values.length) return { bins: [], min: 0, max: 0 };
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV || 1;
  const step = span / bins;

  const counts = Array.from({ length: bins }, () => 0);
  values.forEach((v) => {
    const idx = clamp(Math.floor((v - minV) / step), 0, bins - 1);
    counts[idx]++;
  });

  const out = counts.map((c, i) => ({
    x0: minV + i * step,
    x1: minV + (i + 1) * step,
    count: c,
  }));

  return { bins: out, min: minV, max: maxV };
}

function buildCDF(values: number[], points = 40) {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const out = [];
  for (let i = 0; i < points; i++) {
    const idx = Math.floor((i / (points - 1)) * (n - 1));
    out.push({ x: sorted[idx], p: idx / (n - 1) });
  }
  return out;
}

const MiniHistogram = ({ values }: { values: number[] }) => {
  const hist = useMemo(() => buildHistogram(values, 22), [values]);
  const maxCount = Math.max(...hist.bins.map((b) => b.count), 1);

  return (
    <div className="w-full">
      <div className="text-xs text-slate-500 dark:text-slate-300 mb-2">توزیع NPV (Histogram)</div>
      <div className="h-40 w-full flex items-end gap-1 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/50 dark:bg-slate-950/20 p-3">
        {hist.bins.map((b, i) => (
          <div key={i} className="flex-1 group relative">
            <div
              className="w-full rounded-t-lg bg-blue-500/80"
              style={{ height: `${(b.count / maxCount) * 100}%` }}
            />
            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 text-[10px] bg-slate-900 text-white rounded-lg px-2 py-1 shadow">
              <div>Count: {toPersianDigits(b.count)}</div>
              <div>{formatNumber(b.x0)} تا {formatNumber(b.x1)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MiniCDF = ({ values }: { values: number[] }) => {
  const cdf = useMemo(() => buildCDF(values, 45), [values]);
  if (!cdf.length) return null;

  const w = 560;
  const h = 150;
  const pad = 12;

  const minX = Math.min(...cdf.map((d) => d.x));
  const maxX = Math.max(...cdf.map((d) => d.x));
  const spanX = maxX - minX || 1;

  const path = cdf
    .map((d, i) => {
      const x = pad + ((d.x - minX) / spanX) * (w - 2 * pad);
      const y = pad + (1 - d.p) * (h - 2 * pad);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="w-full mt-6">
      <div className="text-xs text-slate-500 dark:text-slate-300 mb-2">تابع توزیع تجمعی (CDF)</div>
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/50 dark:bg-slate-950/20 p-3">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
          <path d={path} fill="none" stroke="rgba(59,130,246,0.95)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};

type RiskItem = {
  name: string;
  p: number; // 1..5
  i: number; // 1..5
};

const riskDefaults: RiskItem[] = [
  { name: "ریسک بازار", p: 3, i: 4 },
  { name: "ریسک مالی", p: 3, i: 3 },
  { name: "ریسک تامین مالی", p: 2, i: 4 },
  { name: "ریسک فناوری", p: 2, i: 3 },
  { name: "ریسک حقوقی/قانونی", p: 2, i: 3 },
  { name: "ریسک اجرایی", p: 3, i: 4 },
];

function riskLevel(score: number) {
  if (score <= 6) return { label: "Low", cls: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border-emerald-500/30" };
  if (score <= 14) return { label: "Medium", cls: "bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/30" };
  return { label: "High", cls: "bg-rose-500/20 text-rose-700 dark:text-rose-200 border-rose-500/30" };
}

const RiskMatrix = ({ items }: { items: RiskItem[] }) => {
  const mapCell = (v: number) => (v <= 2 ? 0 : v === 3 ? 1 : 2);

  const cells: { list: string[] }[][] = Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => ({ list: [] }))
  );

  items.forEach((r) => {
    const y = mapCell(r.p);
    const x = mapCell(r.i);
    cells[2 - y][x].list.push(r.name);
  });

  const color = (row: number, col: number) => {
    const sum = row + col;
    if (sum <= 1) return "bg-emerald-500/15 border-emerald-500/25";
    if (sum === 2) return "bg-amber-500/15 border-amber-500/25";
    return "bg-rose-500/15 border-rose-500/25";
  };

  const axisLabel = "text-[11px] text-slate-500 dark:text-slate-300";

  return (
    <div className="mt-6">
      <div className="text-xs text-slate-500 dark:text-slate-300 mb-2">Risk Matrix (3×3)</div>
      <div className="grid grid-cols-4 gap-2 items-stretch">
        <div></div>
        <div className={`${axisLabel} text-center`}>کم</div>
        <div className={`${axisLabel} text-center`}>متوسط</div>
        <div className={`${axisLabel} text-center`}>زیاد</div>

        <div className={`${axisLabel} flex items-center justify-center`}>زیاد</div>
        {cells[0].map((c, idx) => (
          <div key={idx} className={`rounded-2xl border p-3 min-h-[90px] ${color(0, idx)}`}>
            <div className="text-[10px] text-slate-500 dark:text-slate-300 mb-2">P↑ / I→</div>
            <ul className="space-y-1 text-xs font-bold">
              {c.list.map((t, i) => <li key={i} className="text-slate-700 dark:text-slate-100">• {t}</li>)}
              {!c.list.length && <li className="text-slate-400 dark:text-slate-400 font-medium">—</li>}
            </ul>
          </div>
        ))}

        <div className={`${axisLabel} flex items-center justify-center`}>متوسط</div>
        {cells[1].map((c, idx) => (
          <div key={idx} className={`rounded-2xl border p-3 min-h-[90px] ${color(1, idx)}`}>
            <div className="text-[10px] text-slate-500 dark:text-slate-300 mb-2">P↑ / I→</div>
            <ul className="space-y-1 text-xs font-bold">
              {c.list.map((t, i) => <li key={i} className="text-slate-700 dark:text-slate-100">• {t}</li>)}
              {!c.list.length && <li className="text-slate-400 dark:text-slate-400 font-medium">—</li>}
            </ul>
          </div>
        ))}

        <div className={`${axisLabel} flex items-center justify-center`}>کم</div>
        {cells[2].map((c, idx) => (
          <div key={idx} className={`rounded-2xl border p-3 min-h-[90px] ${color(2, idx)}`}>
            <div className="text-[10px] text-slate-500 dark:text-slate-300 mb-2">P↑ / I→</div>
            <ul className="space-y-1 text-xs font-bold">
              {c.list.map((t, i) => <li key={i} className="text-slate-700 dark:text-slate-100">• {t}</li>)}
              {!c.list.length && <li className="text-slate-400 dark:text-slate-400 font-medium">—</li>}
            </ul>
          </div>
        ))}
      </div>

      <div className={`${axisLabel} text-center mt-2`}>
        محور افقی: Impact (اثر) — محور عمودی: Probability (احتمال)
      </div>
    </div>
  );
};

export default function MonteCarloAndRisk(props: {
  cashflows: number[];
  baseRate: number;
  rows: { revenue: number; cost: number; net: number; year: number }[];
}) {
  const { cashflows, baseRate, rows } = props;

  const [runs, setRuns] = useState(1000);
  const [revVol, setRevVol] = useState(0.15);
  const [costVol, setCostVol] = useState(0.12);
  const [revTrend, setRevTrend] = useState(0.03);
  const [costTrend, setCostTrend] = useState(0.02);

  const [randomizeRate, setRandomizeRate] = useState(false);
  const [rateVol, setRateVol] = useState(0.05);

  const [values, setValues] = useState<number[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runSim = async () => {
    setIsRunning(true);
    await new Promise((r) => setTimeout(r, 100));

    const out: number[] = [];
    const t0 = cashflows[0];
    const baseYears = rows.length;

    for (let k = 0; k < runs; k++) {
      const simCF: number[] = [t0];

      for (let y = 0; y < baseYears; y++) {
        const baseRev = rows[y].revenue * Math.pow(1 + revTrend, y);
        const baseCost = rows[y].cost * Math.pow(1 + costTrend, y);

        const revShock = 1 + randn() * revVol;
        const costShock = 1 + randn() * costVol;

        const rev = baseRev * revShock;
        const cost = baseCost * costShock;

        simCF.push(rev - cost);
      }

      let r = baseRate;
      if (randomizeRate) {
        const rr = baseRate + randn() * rateVol;
        r = clamp(rr, 0.01, 0.8);
      }

      out.push(npv(simCF, r));
    }

    setValues(out);
    setIsRunning(false);
  };

  const stats = useMemo(() => {
    if (!values.length) return null;
    const m = mean(values);
    const s = std(values);
    const p10 = percentile(values, 10);
    const p50 = percentile(values, 50);
    const p90 = percentile(values, 90);
    const probPos = (values.filter((x) => x > 0).length / values.length) * 100;
    return { m, s, p10, p50, p90, probPos };
  }, [values]);

  const [risks, setRisks] = useState<RiskItem[]>(riskDefaults);

  const totalRiskScore = useMemo(() => {
    const total = risks.reduce((acc, r) => acc + r.p * r.i, 0);
    return total / risks.length;
  }, [risks]);

  const totalLevel = useMemo(() => riskLevel(totalRiskScore), [totalRiskScore]);

  const bestMitigation = useMemo(() => {
    const sorted = [...risks].sort((a, b) => (b.p * b.i) - (a.p * a.i));
    const top = sorted.slice(0, 2);
    const suggestions: Record<string, string[]> = {
      "ریسک بازار": ["تنوع بازار هدف", "پیش‌فروش/قرارداد بلندمدت", "تحلیل رقبا و قیمت‌گذاری پویا"],
      "ریسک مالی": ["کنترل جریان نقدی", "ذخیره نقدینگی اضطراری", "کاهش هزینه‌های ثابت"],
      "ریسک تامین مالی": ["پلان تامین مالی جایگزین", "مذاکره با چند منبع تامین", "فازبندی پروژه"],
      "ریسک فناوری": ["Prototype سریع", "تست پایلوت", "پشتیبان فنی/تامین‌کننده جایگزین"],
      "ریسک حقوقی/قانونی": ["بررسی قراردادها با مشاور حقوقی", "پایش قوانین", "اخذ مجوزهای لازم زودتر"],
      "ریسک اجرایی": ["برنامه زمان‌بندی دقیق", "کنترل کیفیت", "KPI برای پیمانکاران"],
    };
    return top.map((r) => ({
      name: r.name,
      score: r.p * r.i,
      level: riskLevel(r.p * r.i),
      tips: suggestions[r.name] || ["تقسیم ریسک", "کنترل و پایش مستمر", "قراردادهای شفاف"],
    }));
  }, [risks]);

  const card = "bg-white/80 dark:bg-slate-900/60 backdrop-blur rounded-3xl shadow-sm border border-slate-200/70 dark:border-slate-700/60";
  const label = "block text-sm font-bold text-slate-500 dark:text-slate-300 mb-2";
  const input = "w-full bg-slate-50/80 dark:bg-slate-950/30 border-2 border-transparent focus:bg-white dark:focus:bg-slate-950/40 focus:border-blue-500 text-slate-900 dark:text-slate-100 rounded-2xl px-4 py-3 outline-none transition-all shadow-inner";
  const badge = "px-3 py-1.5 rounded-full text-xs font-extrabold border";

  return (
    <div className="space-y-6">
      {/* MONTE CARLO */}
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="bg-blue-500/15 text-blue-700 dark:text-blue-200 p-2 rounded-2xl">
              <BarChart3 size={18} />
            </span>
            <div>
              <h3 className="font-extrabold text-lg">Monte Carlo Simulation</h3>
              <div className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                شبیه‌سازی عدم قطعیت درآمد/هزینه برای توزیع NPV
              </div>
            </div>
          </div>

          <button
            onClick={runSim}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-extrabold transition-all shadow-md disabled:opacity-60"
          >
            {isRunning ? (
              <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span>
            ) : (
              <RefreshCw size={18} className="text-white/80" />
            )}
            Run
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-4 space-y-4">
            <div>
              <label className={label}>تعداد اجرا (Runs)</label>
              <input
                className={`${input} text-center font-extrabold`}
                type="number"
                value={runs}
                min={200}
                max={50000}
                onChange={(e) => setRuns(clamp(Number(e.target.value), 200, 50000))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>نوسان درآمد (σR)</label>
                <input
                  className={`${input} text-center font-extrabold`}
                  type="number"
                  step="0.01"
                  value={revVol}
                  onChange={(e) => setRevVol(clamp(Number(e.target.value), 0, 1))}
                />
              </div>
              <div>
                <label className={label}>نوسان هزینه (σC)</label>
                <input
                  className={`${input} text-center font-extrabold`}
                  type="number"
                  step="0.01"
                  value={costVol}
                  onChange={(e) => setCostVol(clamp(Number(e.target.value), 0, 1))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>روند درآمد (Drift R)</label>
                <input
                  className={`${input} text-center font-extrabold`}
                  type="number"
                  step="0.01"
                  value={revTrend}
                  onChange={(e) => setRevTrend(clamp(Number(e.target.value), -0.2, 0.3))}
                />
              </div>
              <div>
                <label className={label}>روند هزینه (Drift C)</label>
                <input
                  className={`${input} text-center font-extrabold`}
                  type="number"
                  step="0.01"
                  value={costTrend}
                  onChange={(e) => setCostTrend(clamp(Number(e.target.value), -0.2, 0.3))}
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-950/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-extrabold flex items-center gap-2">
                    نرخ تنزیل تصادفی؟
                    <span className="text-slate-400"><AlertTriangle size={16} /></span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                    اگر روشن شود، نرخ تنزیل هم عدم قطعیت می‌گیرد.
                  </div>
                </div>
                <button
                  onClick={() => setRandomizeRate(v => !v)}
                  className={`px-3 py-2 rounded-2xl text-sm font-extrabold border transition-all ${
                    randomizeRate
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {randomizeRate ? "ON" : "OFF"}
                </button>
              </div>

              {randomizeRate && (
                <div className="mt-4">
                  <label className={label}>نوسان نرخ تنزیل (σr)</label>
                  <input
                    className={`${input} text-center font-extrabold`}
                    type="number"
                    step="0.01"
                    value={rateVol}
                    onChange={(e) => setRateVol(clamp(Number(e.target.value), 0.0, 0.25))}
                  />
                  <div className="text-xs text-slate-500 dark:text-slate-300 mt-2">
                    نرخ پایه: {formatNumber(baseRate * 100, 2)}%
                  </div>
                </div>
              )}
            </div>

            {stats && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <div className="text-xs text-blue-700 dark:text-blue-200 font-bold">Mean NPV</div>
                  <div className="text-lg font-extrabold mt-1">{formatNumber(stats.m)}</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-xs text-slate-600 dark:text-slate-300 font-bold">Std Dev</div>
                  <div className="text-lg font-extrabold mt-1">{formatNumber(stats.s)}</div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-xs text-emerald-700 dark:text-emerald-200 font-bold">P(NPV&gt;0)</div>
                  <div className="text-lg font-extrabold mt-1">{formatNumber(stats.probPos, 2)}%</div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-xs text-amber-800 dark:text-amber-200 font-bold">P10 / P50 / P90</div>
                  <div className="text-[13px] font-extrabold mt-1">
                    {formatNumber(stats.p10)} / {formatNumber(stats.p50)} / {formatNumber(stats.p90)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-8">
            {!values.length ? (
              <div className="h-full flex items-center justify-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-950/20 p-10">
                <div className="text-center">
                  <div className="text-slate-500 dark:text-slate-300 font-extrabold">
                    برای دیدن توزیع NPV، روی Run بزن
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    خروجی شامل Histogram و CDF خواهد بود
                  </div>
                </div>
              </div>
            ) : (
              <>
                <MiniHistogram values={values} />
                <MiniCDF values={values} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* RISK MATRIX */}
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="bg-rose-500/15 text-rose-700 dark:text-rose-200 p-2 rounded-2xl">
              <ShieldAlert size={18} />
            </span>
            <div>
              <h3 className="font-extrabold text-lg">Risk Scoring Matrix</h3>
              <div className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                امتیازدهی ریسک (Probability × Impact) + ماتریس 3×3
              </div>
            </div>
          </div>

          <div className={`${badge} ${totalLevel.cls}`}>
            <span className="font-extrabold">Risk Score:</span>{" "}
            <span className="font-extrabold">{formatNumber(totalRiskScore, 2)}</span>{" "}
            <span className="font-extrabold">({totalLevel.label})</span>
          </div>
        </div>

        <div className="overflow-auto rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
          <table className="w-full text-sm">
            <thead className="bg-white/60 dark:bg-slate-950/30 text-slate-500 dark:text-slate-300">
              <tr>
                <th className="p-4 text-right font-extrabold">ریسک</th>
                <th className="p-4 text-center font-extrabold">Probability (1-5)</th>
                <th className="p-4 text-center font-extrabold">Impact (1-5)</th>
                <th className="p-4 text-center font-extrabold">Score</th>
                <th className="p-4 text-center font-extrabold">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/50">
              {risks.map((r, idx) => {
                const score = r.p * r.i;
                const lvl = riskLevel(score);
                return (
                  <tr key={idx} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/5 transition-colors">
                    <td className="p-4 font-extrabold text-slate-800 dark:text-slate-100">{r.name}</td>
                    <td className="p-4 text-center">
                      <input
                        type="range"
                        min={1}
                        max={5}
                        value={r.p}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setRisks(prev => prev.map((x, i) => i === idx ? { ...x, p: v } : x));
                        }}
                        className="w-40"
                      />
                      <div className="text-xs font-extrabold mt-1">{toPersianDigits(r.p)}</div>
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="range"
                        min={1}
                        max={5}
                        value={r.i}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setRisks(prev => prev.map((x, i) => i === idx ? { ...x, i: v } : x));
                        }}
                        className="w-40"
                      />
                      <div className="text-xs font-extrabold mt-1">{toPersianDigits(r.i)}</div>
                    </td>
                    <td className="p-4 text-center font-extrabold">{toPersianDigits(score)}</td>
                    <td className="p-4 text-center">
                      <span className={`${badge} ${lvl.cls}`}>{lvl.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <RiskMatrix items={risks} />

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {bestMitigation.map((m, idx) => (
            <div key={idx} className="rounded-3xl border border-slate-200/70 dark:border-slate-700/60 bg-white/60 dark:bg-slate-950/20 p-5">
              <div className="flex items-center justify-between">
                <div className="font-extrabold text-slate-800 dark:text-slate-100">{m.name}</div>
                <span className={`${badge} ${m.level.cls}`}>{m.level.label} ({toPersianDigits(m.score)})</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-300 mt-2 font-bold">راهکارهای کاهش ریسک:</div>
              <ul className="mt-2 space-y-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {m.tips.slice(0, 3).map((t, i) => (
                  <li key={i}>• {t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-3xl bg-slate-900/5 dark:bg-white/5 border border-slate-200/60 dark:border-slate-700/60 p-5">
          <div className="flex items-center gap-2 font-extrabold">
            <Gauge size={18} className="text-slate-500 dark:text-slate-300" />
            جمع‌بندی ریسک
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-200 leading-7 mt-2">
            اگر Risk Score بالا باشد، حتی با NPV مثبت هم پروژه ممکن است در سناریوهای واقعی شکست بخورد.
            پیشنهاد: روی ۲ ریسک بالا تمرکز کن و کنترل‌های مدیریتی/حقوقی/مالی اعمال کن.
          </div>
        </div>
      </div>
    </div>
  );
}
