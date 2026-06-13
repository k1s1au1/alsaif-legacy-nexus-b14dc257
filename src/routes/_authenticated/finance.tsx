import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { toast } from "sonner";
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finance")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "صندوق العائلة — السيف" },
      { name: "description", content: "إدارة مساهمات ومصاريف صندوق العائلة." },
    ],
  }),
  component: FinancePage,
});

type Tx = {
  id: string;
  type: "contribution" | "expense";
  amount: number;
  description: string;
  occurred_at: string;
  created_by: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n);
}

function FinancePage() {
  const [profile, setProfile] = useState({ name: "عضو العائلة", role: "عضو", initial: "س" });
  const [canManage, setCanManage] = useState(false);
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ type: "contribution" | "expense"; amount: string; description: string }>({
    type: "contribution",
    amount: "",
    description: "",
  });

  const totals = useMemo(() => {
    let income = 0,
      expense = 0;
    for (const r of rows) {
      if (r.type === "contribution") income += Number(r.amount);
      else expense += Number(r.amount);
    }
    return { income, expense, balance: income - expense };
  }, [rows]);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: p }, { data: r }, { data: tx }] = await Promise.all([
      supabase.from("profiles").select("arabic_name, full_name").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      supabase.from("fund_transactions").select("*").order("occurred_at", { ascending: false }),
    ]);
    const roles = (r ?? []).map((x) => x.role);
    const role = roles.includes("admin") ? "admin" : roles.includes("manager") ? "manager" : "member";
    setCanManage(role === "admin" || role === "manager");
    const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو العائلة";
    setProfile({
      name,
      role: role === "admin" ? "مسؤول النظام" : role === "manager" ? "مدير" : "عضو",
      initial: (name[0] ?? "س").toUpperCase(),
    });
    setRows((tx ?? []) as Tx[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error("ادخل مبلغًا صحيحًا");
    if (!form.description.trim()) return toast.error("ادخل وصفًا");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("fund_transactions").insert({
      type: form.type,
      amount: amt,
      description: form.description.trim(),
      created_by: u.user.id,
    });
    if (error) return toast.error(error.message);
    toast.success("تم إضافة المعاملة");
    setForm({ type: "contribution", amount: "", description: "" });
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("حذف هذه المعاملة؟")) return;
    const { error } = await supabase.from("fund_transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    load();
  }

  return (
    <AppShell title="صندوق العائلة" user={profile}>
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card-surface p-6 ring-1 ring-gold-primary/30">
            <div className="flex items-center justify-between">
              <span className="eyebrow">الرصيد المتاح</span>
              <Wallet className="size-4 text-gold-primary" strokeWidth={1.5} />
            </div>
            <div className="text-3xl font-medium text-ivory mt-3">
              {fmt(totals.balance)} <span className="text-sm text-gold-primary">ر.س</span>
            </div>
          </div>
          <div className="card-surface p-6">
            <div className="flex items-center justify-between">
              <span className="eyebrow">إجمالي المساهمات</span>
              <TrendingUp className="size-4 text-emerald-400" strokeWidth={1.5} />
            </div>
            <div className="text-2xl font-medium text-ivory mt-3">
              {fmt(totals.income)} <span className="text-sm text-muted-foreground">ر.س</span>
            </div>
          </div>
          <div className="card-surface p-6">
            <div className="flex items-center justify-between">
              <span className="eyebrow">إجمالي المصاريف</span>
              <TrendingDown className="size-4 text-rose-400" strokeWidth={1.5} />
            </div>
            <div className="text-2xl font-medium text-ivory mt-3">
              {fmt(totals.expense)} <span className="text-sm text-muted-foreground">ر.س</span>
            </div>
          </div>
        </div>

        {/* Action */}
        {canManage && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition"
            >
              <Plus className="size-4" />
              {showForm ? "إلغاء" : "إضافة معاملة"}
            </button>
          </div>
        )}

        {/* Form */}
        {canManage && showForm && (
          <form onSubmit={submit} className="card-surface p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="eyebrow block mb-2">النوع</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as "contribution" | "expense" })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-ivory"
                >
                  <option value="contribution">مساهمة</option>
                  <option value="expense">مصروف</option>
                </select>
              </div>
              <div>
                <label className="eyebrow block mb-2">المبلغ (ر.س)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-ivory"
                />
              </div>
              <div>
                <label className="eyebrow block mb-2">الوصف</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-ivory"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-5 py-2 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition"
            >
              حفظ
            </button>
          </form>
        )}

        {/* Table */}
        <div className="card-surface overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="eyebrow">سجل المعاملات</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">لا توجد معاملات بعد</div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`size-9 rounded-full grid place-items-center shrink-0 ${
                        r.type === "contribution"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {r.type === "contribution" ? (
                        <TrendingUp className="size-4" strokeWidth={1.5} />
                      ) : (
                        <TrendingDown className="size-4" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-ivory truncate">{r.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(r.occurred_at).toLocaleDateString("ar-SA")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span
                      className={`text-sm font-medium ${
                        r.type === "contribution" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {r.type === "contribution" ? "+" : "−"}
                      {fmt(Number(r.amount))} ر.س
                    </span>
                    {canManage && (
                      <button
                        onClick={() => remove(r.id)}
                        className="text-muted-foreground hover:text-rose-400 transition"
                        aria-label="حذف"
                      >
                        <Trash2 className="size-4" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
