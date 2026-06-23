import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
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
} from "lucide-react";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";

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
  const { userId, isLoading: rolesLoading, canManage: canManageSection, primaryRole } = useUserRole();
  const canManage = canManageSection("finance");
  const [rows, setRows] = useState<Tx[]>([]);
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [tab, setTab] = useState<"transactions" | "transfers">("transactions");
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
    if (!u.user) return;
    setUserId(u.user.id);
    const [{ data: p }, { data: r }, { data: tx }, { data: bt }] = await Promise.all([
      supabase.from("profiles").select("arabic_name, full_name").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      supabase.from("fund_transactions").select("*").order("occurred_at", { ascending: false }),
      supabase.from("bank_transfers").select("*").order("created_at", { ascending: false }),
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
    const note = status === "rejected" ? prompt("سبب الرفض (اختياري):") ?? "" : "";
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

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-border">
          <button
            onClick={() => setTab("transactions")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === "transactions"
                ? "border-gold-primary text-gold-primary"
                : "border-transparent text-muted-foreground hover:text-ivory"
            }`}
          >
            سجل المعاملات
          </button>
          <button
            onClick={() => setTab("transfers")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2 ${
              tab === "transfers"
                ? "border-gold-primary text-gold-primary"
                : "border-transparent text-muted-foreground hover:text-ivory"
            }`}
          >
            <Landmark className="size-4" strokeWidth={1.5} />
            التحويلات البنكية
            {pendingCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-gold-primary/20 text-gold-primary text-[10px] font-semibold grid place-items-center">
                {pendingCount}
              </span>
            )}
          </button>
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

            <div className="card-surface overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="eyebrow">سجل المعاملات</h3>
              </div>
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  لا توجد معاملات بعد
                </div>
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
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
  );
}
