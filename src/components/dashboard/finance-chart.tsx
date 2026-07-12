import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const AR_MONTHS_SHORT = [
  "ينا",
  "فبر",
  "مار",
  "أبر",
  "ماي",
  "يون",
  "يول",
  "أغس",
  "سبت",
  "أكت",
  "نوف",
  "ديس",
];

type Tx = { type: string; amount: number | string; occurred_at: string };

export function FinanceChart({ transactions }: { transactions: Tx[] }) {
  const data = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: AR_MONTHS_SHORT[d.getMonth()],
        income: 0,
        expense: 0,
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    for (const t of transactions) {
      const d = new Date(t.occurred_at);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const i = idx.get(k);
      if (i === undefined) continue;
      const amt = Number(t.amount) || 0;
      if (t.type === "contribution") buckets[i].income += amt;
      else buckets[i].expense += amt;
    }
    return buckets;
  }, [transactions]);

  return (
    <div className="h-56 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bfa15d" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#bfa15d" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b8424a" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#b8424a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(245,242,235,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(245,242,235,0.55)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            reversed
          />
          <YAxis
            tick={{ fill: "rgba(245,242,235,0.4)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
            orientation="right"
          />
          <Tooltip
            contentStyle={{
              background: "#0d152b",
              border: "1px solid rgba(191,161,93,0.25)",
              borderRadius: 10,
              direction: "rtl",
              fontFamily: "var(--font-arabic)",
              fontSize: 12,
            }}
            labelStyle={{ color: "#bfa15d" }}
            formatter={(v: number, n) => [
              `${v.toLocaleString("en-US")} ر.س`,
              n === "income" ? "وارد" : "صادر",
            ]}
          />
          <Area
            type="monotone"
            dataKey="income"
            stroke="#bfa15d"
            strokeWidth={2}
            fill="url(#incomeFill)"
          />
          <Area
            type="monotone"
            dataKey="expense"
            stroke="#b8424a"
            strokeWidth={2}
            fill="url(#expenseFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
