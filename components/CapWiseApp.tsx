"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  DollarSign,
  Percent,
  LineChart,
  Download,
  Info,
  Moon,
  Sun,
  Sparkles,
  X,
} from "lucide-react";
import MonteCarloAndRisk from "./MonteCarloAndRisk";

/* ----------------- Utils ----------------- */
const farsiDigits = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];

const toPersianDigits = (num: number | string) =>
  num.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x, 10)]);

const parsePersianInput = (val: string) => {
  return val
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[^0-9.-]/g, "");
};

const formatNumber = (num: number, decimals = 0) => {
  if (!isFinite(num)) return "—";
  const v = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(num);
  return toPersianDigits(v);
};

function npv(cashflows: number[], rate: number) {
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

function irr(cashflows: number[], guess = 0.2) {
  let x = guess;
  for (let i = 0; i < 80; i++) {
    let f = 0;
    let df = 0;
    for (let t = 0; t < cashflows.length; t++) {
      f += cashflows[t] / Math.pow(1 + x, t);
      df += (-t * cashflows[t]) / Math.pow(1 + x, t + 1);
    }
    const nx = x - f / df;
    if (!isFinite(nx)) break;
    if (Math.abs(nx - x) < 1e-9) return nx;
    x = nx;
  }
  return NaN;
}

function realRateFromNominal(nominal: number, inflation: number) {
  return (1 + nominal) / (1 + inflation) - 1;
}

type CashflowRow = { year: number; revenue: number; cost: number; net: number; };

const MiniLineChart = ({ points, height = 120 }: { points: number[]; height?: number }) => {
  const w = 560;
  const h = height;
  const pad = 12;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;

  const path = points
    .map((p, i) => {
      const x = pad + (i * (w - pad * 2)) / (points.length - 1 || 1);
      const y = pad + (1 - (p - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const zeroY = pad + (1 - (0 - min) / span) * (h - pad * 2);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY} stroke="rgba(148,163,184,0.5)" strokeDasharray="4 4" strokeWidth="1" />
      <path d={path} fill="none" stroke="rgba(59,130,246,0.95)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
};

/* ----------------- Offline/Fallback Analysis ----------------- */
function fallbackAnalysis(args: {
  name: string;
  npvValue: number;
  irrValue: number;
  rate: number;
}) {
  const { name, npvValue, irrValue, rate } = args;
  const irrPct = irrValue * 100;
  const ratePct = rate * 100;

  const goodNPV = npvValue > 0;
  const goodIRR = irrValue > rate;

  let verdict = "⛔ توصیه نمی‌شود";
  if (goodNPV && goodIRR) verdict = "✅ پیشنهاد می‌شود";
  else if (goodNPV || goodIRR) verdict = "⚠️ نیاز به بهینه‌سازی دارد";

  const reasons = [
    goodNPV
      ? `NPV پروژه مثبت است (حدود ${formatNumber(npvValue)}). یعنی ارزش فعلی درآمدها از هزینه اولیه بیشتر است.`
      : `NPV پروژه منفی است (حدود ${formatNumber(npvValue)}). یعنی با نرخ تنزیل فعلی، پروژه توجیه اقتصادی ندارد.`,
    isFinite(irrValue)
      ? goodIRR
        ? `IRR پروژه حدود ${formatNumber(irrPct, 2)}% است و از نرخ تنزیل ${formatNumber(ratePct, 2)}% بالاتر است.`
        : `IRR پروژه حدود ${formatNumber(irrPct, 2)}% است و از نرخ تنزیل ${formatNumber(ratePct, 2)}% پایین‌تر است.`
      : "IRR قابل محاسبه نبود (به دلیل شکل جریان نقدی).",
  ];

  const tips = [
    "اگر NPV منفی است: یا هزینه اولیه را کاهش بده، یا درآمد سالانه را افزایش بده، یا ریسک پروژه را کم کن تا نرخ تنزیل پایین‌تر بیاید.",
    "سناریو بدبینانه را جدی بگیر: اگر با ۱۰٪ کاهش درآمد پروژه زمین می‌خورد، پروژه ریسکی است.",
    "برای بهبود IRR: زمان بازگشت سرمایه را کوتاه‌تر کن (درآمد بیشتر در سال‌های اول).",
  ];

  return `
🔎 تحلیل داخلی (بدون Gemini) برای پروژه «${name}»

⭐ نتیجه نهایی: ${verdict}

📌 دلیل‌ها:
- ${reasons[0]}
- ${reasons[1]}

💡 پیشنهادهای بهبود:
- ${tips[0]}
- ${tips[1]}
- ${tips[2]}
`;
}

/* ----------------- Cache Key ----------------- */
function makeCacheKey(payload: any) {
  return "capwise_ai_cache_" + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

export default function CapWiseApp() {
  const [dark, setDark] = useState(false);
  const [activeTab, setActiveTab] = useState<"cashflow" | "montecarlo" | "risk">("cashflow");

  const [projectName, setProjectName] = useState("پروژه جدید");
  const [initialInvestment, setInitialInvestment] = useState<number>(800000000);
  const [initialInvestmentDisplay, setInitialInvestmentDisplay] = useState("");

  const [discountRate, setDiscountRate] = useState(0.25);
  const [inflation, setInflation] = useState(0.35);
  const [useRealRate, setUseRealRate] = useState(false);

  const [years, setYears] = useState(5);
  const [scenario, setScenario] = useState<"base" | "optimistic" | "pessimistic">("base");

  const [rows, setRows] = useState<CashflowRow[]>([]);

  // AI State
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    setInitialInvestmentDisplay(formatNumber(initialInvestment));
  }, []);

  useEffect(() => {
    const base: CashflowRow[] = Array.from({ length: years }, (_, i) => {
      const y = i + 1;
      const revenue = 450000000;
      const cost = 220000000;
      return { year: y, revenue, cost, net: revenue - cost };
    });
    setRows(base);
  }, [years]);

  const effectiveRate = useMemo(() => {
    const r = useRealRate ? realRateFromNominal(discountRate, inflation) : discountRate;
    return r;
  }, [discountRate, inflation, useRealRate]);

  const scenarioRows = useMemo(() => {
    const mul = (revMul: number, costMul: number) =>
      rows.map((r) => {
        const revenue = r.revenue * revMul;
        const cost = r.cost * costMul;
        return { ...r, revenue, cost, net: revenue - cost };
      });

    if (scenario === "optimistic") return mul(1.12, 0.95);
    if (scenario === "pessimistic") return mul(0.88, 1.1);
    return rows;
  }, [rows, scenario]);

  const cashflows = useMemo(() => {
    const cfs = [-Math.abs(initialInvestment)];
    scenarioRows.forEach((r) => cfs.push(r.net));
    return cfs;
  }, [initialInvestment, scenarioRows]);

  const KPI = useMemo(() => {
    const vNPV = npv(cashflows, effectiveRate);
    const vIRR = irr(cashflows, 0.2);
    return { vNPV, vIRR };
  }, [cashflows, effectiveRate]);

  const npvProfile = useMemo(() => {
    const pts: number[] = [];
    for (let r = 0; r <= 40; r += 2) pts.push(npv(cashflows, r / 100));
    return pts;
  }, [cashflows]);

  const exportCSV = () => {
    const header = ["Year", "Revenue", "Cost", "Net"].join(",");
    const body = scenarioRows.map((r) => [r.year, r.revenue, r.cost, r.net].join(",")).join("\n");
    const csv = header + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "capwise_cashflows.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  async function callGeminiWithRetry(prompt: string, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });

        const data = await res.json();

        if (res.status === 429) {
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 5000));
            continue;
          }
          return { ok: false, error: "RATE_LIMIT", data };
        }

        if (!res.ok) return { ok: false, error: "API_ERROR", data };
        return { ok: true, text: data.text as string };
      } catch (e) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        return { ok: false, error: "NETWORK_ERROR", details: String(e) };
      }
    }
    return { ok: false, error: "UNKNOWN" };
  }

  const callAdvisor = async () => {
    setIsLoading(true);
    setShowAnalysis(true);
    setAiAnalysis("");

    const payloadForCache = {
      projectName,
      initialInvestment,
      discountRate,
      inflation,
      useRealRate,
      scenario,
      years,
      npv: KPI.vNPV,
      irr: KPI.vIRR,
    };

    const cacheKey = makeCacheKey(payloadForCache);

    // ✅ Cache
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setAiAnalysis("✅ (از Cache)\n\n" + cached);
      setIsLoading(false);
      return;
    }

    const prompt = `
تو یک مشاور اقتصاد مهندسی هستی.
این پروژه را خیلی خودمونی تحلیل کن:

نام پروژه: ${projectName}
سرمایه اولیه: ${initialInvestment}
نرخ تنزیل موثر: ${effectiveRate}
NPV: ${KPI.vNPV}
IRR: ${KPI.vIRR}

1) ارزش انجام دارد یا نه؟
2) چرا؟
3) دو پیشنهاد برای بهتر کردن پروژه بده.
`;

    const result = await callGeminiWithRetry(prompt, 2);

    if (result.ok) {
      const txt = result.text ?? ""; localStorage.setItem(cacheKey, txt);
      setAiAnalysis(txt);
    } else {
      // ✅ Fallback
      const fb = fallbackAnalysis({
        name: projectName,
        npvValue: KPI.vNPV,
        irrValue: KPI.vIRR,
        rate: effectiveRate,
      });

      setAiAnalysis(`⚠️ Gemini فعلاً در دسترس نیست.\n\n${fb}`);
    }

    setIsLoading(false);
  };

  const cardBase =
    "bg-white/80 dark:bg-slate-900/60 backdrop-blur rounded-3xl shadow-sm border border-slate-200/70 dark:border-slate-700/60";
  const inputBase =
    "w-full bg-slate-50/80 dark:bg-slate-950/30 border-2 border-transparent focus:bg-white dark:focus:bg-slate-950/40 focus:border-blue-500 text-slate-900 dark:text-slate-100 rounded-2xl px-4 py-3 outline-none transition-all shadow-inner";
  const subtleText = "text-slate-500 dark:text-slate-300";

  const tabButton = (key: any, title: string) => (
    <button
      onClick={() => setActiveTab(key)}
      className={`px-5 py-3 rounded-2xl font-extrabold text-sm transition-all border ${
        activeTab === key
          ? "bg-blue-600 text-white border-blue-600 shadow-md"
          : "bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white"
      }`}
    >
      {title}
    </button>
  );

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen text-slate-900 dark:text-slate-100 font-[Vazirmatn,system-ui,sans-serif]" dir="rtl">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@200;300;400;500;700;800;900&display=swap');
          body { font-family: 'Vazirmatn', sans-serif; }
          .dir-ltr { direction:ltr; }
        `}</style>

        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900" />

        <div className="max-w-6xl mx-auto py-6 px-4 md:px-8">

          {/* HEADER */}
          <div className={`${cardBase} p-6 mb-6`}>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg">
                  <Calculator size={32} />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">CapWise | تحلیل اقتصادی پروژه</h1>
                  <p className={`${subtleText} text-sm mt-1 font-light`}>
                    Cashflow + MonteCarlo + Risk + AI
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDark((d) => !d)}
                  className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 hover:bg-white transition-all shadow-sm"
                >
                  {dark ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 hover:bg-white transition-all shadow-sm font-extrabold"
                >
                  <Download size={18} />
                  خروجی CSV
                </button>

                <button
                  onClick={callAdvisor}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-extrabold transition-all shadow-md disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span>
                  ) : (
                    <Sparkles size={18} className="text-yellow-300" />
                  )}
                  تحلیل هوشمند
                </button>
              </div>
            </div>
          </div>

          {/* AI PANEL */}
          {showAnalysis && (
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur rounded-3xl shadow-xl border border-blue-200/30 dark:border-slate-700/60 p-6 mb-6 relative">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-extrabold text-lg flex items-center gap-2">
                  <Sparkles className="text-yellow-400" size={18} />
                  تحلیل هوشمند
                </h3>
                <button
                  onClick={() => setShowAnalysis(false)}
                  className="p-2 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="text-sm md:text-base leading-8 whitespace-pre-line text-slate-700 dark:text-slate-200">
                {isLoading ? "در حال تحلیل..." : aiAnalysis || "تحلیل آماده نیست"}
              </div>
            </div>
          )}

          {/* TABS */}
          <div className="flex flex-wrap gap-2 mb-6">
            {tabButton("cashflow", "Cashflow")}
            {tabButton("montecarlo", "Monte Carlo")}
            {tabButton("risk", "Risk Matrix")}
          </div>

          {/* CASHFLOW TAB */}
          {activeTab === "cashflow" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* RIGHT */}
              <div className="lg:col-span-4 space-y-6">
                <div className={`${cardBase} p-6 md:p-8`}>
                  <h3 className="text-lg font-extrabold mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                    مشخصات پروژه
                  </h3>

                  <div className="space-y-5">
                    <div>
                      <label className={`block text-sm font-semibold ${subtleText} mb-2`}>نام پروژه</label>
                      <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className={inputBase} />
                    </div>

                    <div className="group">
                      <label className={`block text-sm font-semibold ${subtleText} mb-2`}>سرمایه اولیه I0</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={initialInvestmentDisplay}
                          onChange={(e) => {
                            const raw = parsePersianInput(e.target.value);
                            const n = raw === "" ? 0 : Number(raw);
                            setInitialInvestment(n);
                            setInitialInvestmentDisplay(formatNumber(n));
                          }}
                          className={`${inputBase} text-left dir-ltr text-xl font-extrabold`}
                        />
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                          <DollarSign className="text-slate-300 dark:text-slate-500" size={18} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="group">
                        <label className={`block text-sm font-semibold ${subtleText} mb-2`}>نرخ تنزیل i (%)</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={(discountRate * 100).toFixed(2)}
                            onChange={(e) => setDiscountRate(Number(e.target.value) / 100)}
                            className={`${inputBase} text-center font-extrabold`}
                          />
                          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>
                      </div>

                      <div className="group">
                        <label className={`block text-sm font-semibold ${subtleText} mb-2`}>تورم f (%)</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={(inflation * 100).toFixed(2)}
                            onChange={(e) => setInflation(Number(e.target.value) / 100)}
                            className={`${inputBase} text-center font-extrabold`}
                          />
                          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-950/20">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-extrabold flex items-center gap-2">
                            روش نرخ تنزیل
                            <span className="text-slate-400">
                              <Info size={16} />
                            </span>
                          </div>
                          <div className={`text-xs ${subtleText} mt-1`}>
                            {useRealRate ? "Real Rate = (1+i)/(1+f)-1" : "Direct Nominal Rate"}
                          </div>
                        </div>
                        <button
                          onClick={() => setUseRealRate((v) => !v)}
                          className={`px-3 py-2 rounded-2xl text-sm font-extrabold border transition-all ${
                            useRealRate
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {useRealRate ? "Real" : "Nominal"}
                        </button>
                      </div>
                      <div className="mt-4">
                        <div className={`text-xs ${subtleText}`}>نرخ موثر</div>
                        <div className="text-lg font-extrabold mt-1">{formatNumber(effectiveRate * 100, 2)}%</div>
                      </div>
                    </div>

                    <div>
                      <label className={`block text-sm font-semibold ${subtleText} mb-2`}>سناریو</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { k: "base", t: "Base" },
                          { k: "optimistic", t: "خوشبینانه" },
                          { k: "pessimistic", t: "بدبینانه" },
                        ].map((s) => (
                          <button
                            key={s.k}
                            onClick={() => setScenario(s.k as any)}
                            className={`py-2 rounded-2xl text-xs font-extrabold border transition-all ${
                              scenario === s.k
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white/80 border-slate-200 text-slate-600 hover:bg-white"
                            }`}
                          >
                            {s.t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={`block text-sm font-semibold ${subtleText} mb-2`}>تعداد سال‌ها</label>
                      <input
                        type="number"
                        value={years}
                        onChange={(e) => setYears(Math.max(1, Math.min(20, Number(e.target.value))))}
                        className={`${inputBase} text-center font-extrabold`}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-b from-blue-600 to-indigo-600 rounded-3xl shadow-lg p-6 text-white">
                  <div className="text-blue-100 text-sm mb-1 font-semibold">NPV</div>
                  <div className="text-4xl font-extrabold">{formatNumber(KPI.vNPV)}</div>
                  <div className="grid grid-cols-2 gap-4 pt-4 mt-4 border-t border-white/20">
                    <div>
                      <div className="text-blue-200 text-xs mb-1">IRR</div>
                      <div className="font-extrabold text-lg">{formatNumber(KPI.vIRR * 100, 2)}%</div>
                    </div>
                  </div>
                </div>

                <div className={`${cardBase} p-6`}>
                  <h3 className="font-extrabold mb-2 flex items-center gap-2">
                    <LineChart size={20} className="text-slate-400" />
                    NPV Profile
                  </h3>
                  <MiniLineChart points={npvProfile} />
                </div>
              </div>

              {/* LEFT */}
              <div className="lg:col-span-8 space-y-6">
                <div className={`${cardBase} overflow-hidden`}>
                  <div className="p-5 border-b border-slate-200/60 dark:border-slate-700/60 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
                    <h3 className="font-extrabold">جدول جریان‌های نقدی</h3>
                  </div>

                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-300 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="p-4 text-center font-semibold w-16">سال</th>
                          <th className="p-4 text-right font-semibold text-emerald-600">درآمد</th>
                          <th className="p-4 text-right font-semibold text-rose-500">هزینه</th>
                          <th className="p-4 text-right font-semibold">خالص</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/40">
                        {scenarioRows.map((r) => (
                          <tr key={r.year} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/5 transition-colors">
                            <td className="p-4 text-center text-slate-400 font-semibold bg-slate-50/30 dark:bg-slate-950/10">
                              {toPersianDigits(r.year)}
                            </td>
                            <td className="p-4 font-extrabold text-emerald-700 dark:text-emerald-300">{formatNumber(r.revenue)}</td>
                            <td className="p-4 font-extrabold text-rose-600 dark:text-rose-300">{formatNumber(r.cost)}</td>
                            <td className={`p-4 font-extrabold ${r.net >= 0 ? "text-slate-800 dark:text-slate-100" : "text-rose-600"}`}>
                              {formatNumber(r.net)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div dir="ltr" className="mt-8 mb-6 text-center text-slate-400 text-sm font-light flex items-center justify-center gap-2 select-none">
                    <span className="opacity-70">Made with</span>
                    <span className="opacity-70">Amirhamzeh</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MONTECARLO TAB */}
          {activeTab === "montecarlo" && (
            <MonteCarloAndRisk cashflows={cashflows} baseRate={effectiveRate} rows={scenarioRows} />
          )}

          {/* RISK TAB (same component, but scroll to Risk section) */}
          {activeTab === "risk" && (
            <MonteCarloAndRisk cashflows={cashflows} baseRate={effectiveRate} rows={scenarioRows} />
          )}

        </div>
      </div>
    </div>
  );
}
