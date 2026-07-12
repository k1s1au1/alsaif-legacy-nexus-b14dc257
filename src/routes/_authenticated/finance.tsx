import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { toast } from "sonner";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Landmark,
  Check,
  X,
  Clock,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { FamilyProjects } from "@/components/family-projects";

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

type BankTransfer = {
  id: string;
  submitted_by: string;
  amount: number;
  sender_name: string;
  reference_number: string | null;
  transferred_at: string;
  receipt_url: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  fund_transaction_id: string | null;
  created_at: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n);
}

function FinancePage() {
  const [profile, setProfile] = useState({ name: "عضو العائلة", role: "عضو", initial: "س" });
  const {
    userId,
    isLoading: rolesLoading,
    canManage: canManageSection,
    primaryRole,
  } = useUserRole();
  const canManage = canManageSection("finance");
  const dynamicLogo = useSiteLogo();
  const [rows, setRows] = useState<Tx[]>([]);
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [tab, setTab] = useState<"transactions" | "transfers" | "projects">("transactions");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [form, setForm] = useState<{
    type: "contribution" | "expense";
    amount: string;
    description: string;
  }>({ type: "contribution", amount: "", description: "" });
  const [transferForm, setTransferForm] = useState({
    amount: "",
    sender_name: "",
    reference_number: "",
    transferred_at: new Date().toISOString().slice(0, 16),
    note: "",
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

  const pendingCount = useMemo(
    () => transfers.filter((t) => t.status === "pending").length,
    [transfers],
  );

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }
    const [{ data: p }, { data: tx }, { data: bt }] = await Promise.all([
      supabase.from("profiles").select("arabic_name, full_name").eq("id", u.user.id).maybeSingle(),
      supabase.from("fund_transactions").select("*").order("occurred_at", { ascending: false }),
      supabase.from("bank_transfers").select("*").order("created_at", { ascending: false }),
    ]);
    const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو العائلة";
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const rs = (r ?? []).map((x) => x.role);
    setProfile({
      name,
      role: rs.includes("admin") ? "مسؤول النظام" : rs.includes("chairman") ? "رئيس المجلس" : "عضو",
      initial: (name[0] ?? "س").toUpperCase(),
    });
    setRows((tx ?? []) as Tx[]);
    setTransfers((bt ?? []) as BankTransfer[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("finance-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fund_transactions" },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Tx;
              if (prev.some((r) => r.id === row.id)) return prev;
              return [row, ...prev].sort(
                (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
              );
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Tx;
              return prev.map((r) => (r.id === row.id ? row : r));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id: string };
              return prev.filter((r) => r.id !== row.id);
            }
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bank_transfers" },
        (payload) => {
          setTransfers((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as BankTransfer;
              if (prev.some((r) => r.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as BankTransfer;
              return prev.map((r) => (r.id === row.id ? row : r));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id: string };
              return prev.filter((r) => r.id !== row.id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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
  }

  async function remove(id: string) {
    if (!confirm("حذف هذه المعاملة؟")) return;
    const { error } = await supabase.from("fund_transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
  }

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(transferForm.amount);
    if (!amt || amt <= 0) return toast.error("ادخل مبلغًا صحيحًا");
    if (!transferForm.sender_name.trim()) return toast.error("ادخل اسم المُرسل");
    if (!userId) return;
    const { error } = await supabase.from("bank_transfers").insert({
      submitted_by: userId,
      amount: amt,
      sender_name: transferForm.sender_name.trim(),
      reference_number: transferForm.reference_number.trim() || null,
      transferred_at: new Date(transferForm.transferred_at).toISOString(),
      note: transferForm.note.trim() || null,
    });
    if (error) {
      if (error.code === "23505") return toast.error("الرقم المرجعي مُسجّل مسبقًا");
      return toast.error(error.message);
    }
    toast.success("تم إرسال طلب التحويل للمراجعة");
    setTransferForm({
      amount: "",
      sender_name: "",
      reference_number: "",
      transferred_at: new Date().toISOString().slice(0, 16),
      note: "",
    });
    setShowTransferForm(false);
  }

  async function reviewTransfer(id: string, status: "approved" | "rejected") {
    const note = status === "rejected" ? (prompt("سبب الرفض (اختياري):") ?? "") : "";
    if (!userId) return;
    const { error } = await supabase
      .from("bank_transfers")
      .update({
        status,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "تمت الموافقة وتحديث الرصيد" : "تم رفض الطلب");
  }

  return (
    <AppShell title="صندوق العائلة" user={profile}>
      <div className="max-w-5xl mx-auto space-y-8 pb-24 px-4 md:px-0" dir="rtl">
        <QuickActionsBanner />

        {/* HERO — Soft Modern Balance Card */}
        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[40px] shadow-2xl border border-white/10 group">
            {/* gradient bg */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900" />
            <div className="absolute -top-24 -left-16 size-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-16 size-72 bg-gold-primary/20 rounded-full blur-3xl" />
            <div
              className="absolute right-6 top-6 size-28 md:size-40 opacity-15 logo-alsaif-banner pointer-events-none transition-all duration-1000 group-hover:opacity-25 group-hover:scale-110"
              style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any}
            />

            <div className="relative z-10 p-8 md:p-12 text-white flex flex-col items-center text-center">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px w-8 bg-gold-primary/70" />
                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary/90">
                  التكافل العائلي
                </span>
                <div className="h-px w-8 bg-gold-primary/70" />
              </div>
              <p className="text-emerald-100/80 text-sm font-medium mb-2">رصيد صندوق العائلة</p>
              <h1 className="text-5xl md:text-7xl font-black tracking-tight drop-shadow-2xl tabular-nums">
                <CountUp value={totals.balance} />
                <span className="text-xl md:text-2xl font-bold opacity-80 mr-3">ر.س</span>
              </h1>

              {/* Mini summary chips */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
                <div className="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md flex items-center gap-2">
                  <TrendingUp className="size-3.5 text-emerald-300" strokeWidth={2} />
                  <span className="text-emerald-50/90">مساهمات</span>
                  <span className="font-bold text-white tabular-nums">{fmt(totals.income)}</span>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md flex items-center gap-2">
                  <TrendingDown className="size-3.5 text-rose-300" strokeWidth={2} />
                  <span className="text-rose-50/90">مصاريف</span>
                  <span className="font-bold text-white tabular-nums">{fmt(totals.expense)}</span>
                </div>
              </div>

              {/* Action row */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
                <button
                  onClick={() => {
                    setTab("transfers");
                    setShowTransferForm(true);
                    setTimeout(() => window.scrollTo({ top: 400, behavior: "smooth" }), 50);
                  }}
                  className="flex-1 min-w-[120px] bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Plus className="size-4" strokeWidth={2.5} />
                  إيداع / تحويل
                </button>
                {canManage && (
                  <button
                    onClick={() => {
                      setTab("transactions");
                      setShowForm(true);
                      setTimeout(() => window.scrollTo({ top: 400, behavior: "smooth" }), 50);
                    }}
                    className="flex-1 min-w-[120px] bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <TrendingDown className="size-4" strokeWidth={2.5} />
                    تسجيل مصروف
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Segmented Pill Tabs */}
        <div className="flex p-1.5 bg-card/60 border border-border rounded-2xl overflow-x-auto gap-1">
          <TabPill active={tab === "transactions"} onClick={() => setTab("transactions")}>
            <Wallet className="size-4" strokeWidth={2} />
            <span>المعاملات</span>
          </TabPill>
          <TabPill
            active={tab === "transfers"}
            onClick={() => setTab("transfers")}
            badge={pendingCount}
          >
            <Landmark className="size-4" strokeWidth={2} />
            <span>التحويلات البنكية</span>
          </TabPill>
          <TabPill active={tab === "projects"} onClick={() => setTab("projects")}>
            <Lightbulb className="size-4" strokeWidth={2} />
            <span>مشاريع العائلة</span>
          </TabPill>
        </div>

        {/* TRANSACTIONS TAB */}
        {tab === "transactions" && (
          <>
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

            {canManage && showForm && (
              <form onSubmit={submit} className="card-surface p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="eyebrow block mb-2">النوع</label>
                    <select
                      value={form.type}
                      onChange={(e) =>
                        setForm({ ...form, type: e.target.value as "contribution" | "expense" })
                      }
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

            <div className="space-y-3">
              <div className="flex items-end justify-between px-1">
                <h3 className="font-bold text-ivory">آخر العمليات</h3>
                <span className="text-[11px] text-muted-foreground">{rows.length} معاملة</span>
              </div>
              {loading ? (
                <div className="card-surface p-8 text-center text-muted-foreground text-sm">
                  جاري التحميل...
                </div>
              ) : rows.length === 0 ? (
                <div className="card-surface p-10 text-center">
                  <Wallet
                    className="size-10 text-muted-foreground/40 mx-auto mb-3"
                    strokeWidth={1.2}
                  />
                  <p className="text-muted-foreground text-sm">لا توجد معاملات بعد</p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  <AnimatePresence initial={false}>
                    {rows.map((r, i) => (
                      <motion.li
                        key={r.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.2) }}
                        className="group flex items-center justify-between gap-4 p-4 rounded-2xl bg-card/60 border border-border hover:border-gold-primary/30 hover:bg-card transition-all"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className={cn(
                              "size-12 rounded-2xl grid place-items-center shrink-0 transition-all group-hover:scale-110",
                              r.type === "contribution"
                                ? "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20",
                            )}
                          >
                            {r.type === "contribution" ? (
                              <TrendingUp className="size-5" strokeWidth={2} />
                            ) : (
                              <TrendingDown className="size-5" strokeWidth={2} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-ivory truncate">{r.description}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {new Date(r.occurred_at).toLocaleDateString("ar-SA", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={cn(
                              "text-sm font-black tabular-nums px-3 py-1.5 rounded-xl",
                              r.type === "contribution"
                                ? "text-emerald-400 bg-emerald-500/5"
                                : "text-rose-400 bg-rose-500/5",
                            )}
                          >
                            {r.type === "contribution" ? "+" : "−"}
                            {fmt(Number(r.amount))} ر.س
                          </span>
                          {canManage && (
                            <button
                              onClick={() => remove(r.id)}
                              className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition opacity-0 group-hover:opacity-100"
                              aria-label="حذف"
                            >
                              <Trash2 className="size-4" strokeWidth={1.8} />
                            </button>
                          )}
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </>
        )}

        {/* TRANSFERS TAB */}
        {tab === "transfers" && (
          <>
            <div className="flex justify-end">
              <button
                onClick={() => setShowTransferForm((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition"
              >
                <Plus className="size-4" />
                {showTransferForm ? "إلغاء" : "تسجيل تحويل بنكي"}
              </button>
            </div>

            {showTransferForm && (
              <form onSubmit={submitTransfer} className="card-surface p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="eyebrow block mb-2">المبلغ (ر.س)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={transferForm.amount}
                      onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-ivory"
                      required
                    />
                  </div>
                  <div>
                    <label className="eyebrow block mb-2">اسم المُرسل</label>
                    <input
                      type="text"
                      value={transferForm.sender_name}
                      onChange={(e) =>
                        setTransferForm({ ...transferForm, sender_name: e.target.value })
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-ivory"
                      required
                    />
                  </div>
                  <div>
                    <label className="eyebrow block mb-2">الرقم المرجعي (اختياري)</label>
                    <input
                      type="text"
                      value={transferForm.reference_number}
                      onChange={(e) =>
                        setTransferForm({ ...transferForm, reference_number: e.target.value })
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-ivory"
                    />
                  </div>
                  <div>
                    <label className="eyebrow block mb-2">تاريخ ووقت التحويل</label>
                    <input
                      type="datetime-local"
                      value={transferForm.transferred_at}
                      onChange={(e) =>
                        setTransferForm({ ...transferForm, transferred_at: e.target.value })
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-ivory"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="eyebrow block mb-2">ملاحظة (اختياري)</label>
                    <input
                      type="text"
                      value={transferForm.note}
                      onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-ivory"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition"
                >
                  إرسال للمراجعة
                </button>
              </form>
            )}

            <div className="card-surface overflow-hidden">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h3 className="eyebrow">طلبات التحويل</h3>
                <span className="text-xs text-muted-foreground">{transfers.length} إجمالي</span>
              </div>
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
              ) : transfers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  لا توجد تحويلات بنكية بعد
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {transfers.map((t) => (
                    <li key={t.id} className="p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-4 min-w-0 flex-1">
                          <StatusIcon status={t.status} />
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm text-ivory font-medium">{t.sender_name}</p>
                              <StatusBadge status={t.status} />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(t.transferred_at).toLocaleString("ar-SA")}
                              {t.reference_number && (
                                <>
                                  {" · "}
                                  <span>مرجع: {t.reference_number}</span>
                                </>
                              )}
                            </p>
                            {t.note && (
                              <p className="text-[11px] text-muted-foreground">{t.note}</p>
                            )}
                            {t.review_note && (
                              <p className="text-[11px] text-rose-400">
                                ملاحظة المراجعة: {t.review_note}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-medium text-emerald-400">
                            +{fmt(Number(t.amount))} ر.س
                          </span>
                          {canManage && t.status === "pending" && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => reviewTransfer(t.id, "approved")}
                                className="size-8 grid place-items-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
                                aria-label="موافقة"
                                title="موافقة"
                              >
                                <Check className="size-4" strokeWidth={2} />
                              </button>
                              <button
                                onClick={() => reviewTransfer(t.id, "rejected")}
                                className="size-8 grid place-items-center rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                                aria-label="رفض"
                                title="رفض"
                              >
                                <X className="size-4" strokeWidth={2} />
                              </button>
                            </div>
                          )}
                          {canManage && t.status === "approved" && (
                            <button
                              onClick={() => reviewTransfer(t.id, "rejected")}
                              className="text-[11px] text-muted-foreground hover:text-rose-400 transition"
                              title="عكس الموافقة"
                            >
                              عكس
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* PROJECTS TAB */}
        {tab === "projects" && (
          <FamilyProjects userId={userId} canManage={canManage} fundBalance={totals.balance} />
        )}
      </div>
    </AppShell>
  );
}

function StatusIcon({ status }: { status: BankTransfer["status"] }) {
  if (status === "approved")
    return (
      <div className="size-9 rounded-full grid place-items-center shrink-0 bg-emerald-500/10 text-emerald-400">
        <Check className="size-4" strokeWidth={1.5} />
      </div>
    );
  if (status === "rejected")
    return (
      <div className="size-9 rounded-full grid place-items-center shrink-0 bg-rose-500/10 text-rose-400">
        <X className="size-4" strokeWidth={1.5} />
      </div>
    );
  return (
    <div className="size-9 rounded-full grid place-items-center shrink-0 bg-gold-primary/10 text-gold-primary">
      <Clock className="size-4" strokeWidth={1.5} />
    </div>
  );
}

function StatusBadge({ status }: { status: BankTransfer["status"] }) {
  const map = {
    pending: { label: "قيد المراجعة", cls: "bg-gold-primary/10 text-gold-primary" },
    approved: { label: "موافق عليه", cls: "bg-emerald-500/10 text-emerald-400" },
    rejected: { label: "مرفوض", cls: "bg-rose-500/10 text-rose-400" },
  } as const;
  const { label, cls } = map[status];
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}

function TabPill({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap",
        active
          ? "bg-gold-primary text-navy-base shadow-lg shadow-gold-primary/20"
          : "text-muted-foreground hover:text-ivory hover:bg-card",
      )}
    >
      {children}
      {badge && badge > 0 ? (
        <span
          className={cn(
            "min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-black grid place-items-center",
            active ? "bg-navy-base/20 text-navy-base" : "bg-gold-primary/20 text-gold-primary",
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function CountUp({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = display;
    const delta = value - from;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + delta * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{fmt(Math.round(display))}</>;
}
