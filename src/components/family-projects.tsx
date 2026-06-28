import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Plus,
  Check,
  X,
  Clock,
  Trash2,
  HandCoins,
  Target,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  title: string;
  description: string;
  goal_amount: number;
  fund_allocation: number;
  fund_transaction_id: string | null;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  proposed_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

type Contribution = {
  id: string;
  project_id: string;
  contributor_id: string | null;
  amount: number;
  note: string | null;
  created_at: string;
};

type Profile = { id: string; arabic_name: string | null; full_name: string | null };

function fmt(n: number) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n);
}

export function FamilyProjects({
  userId,
  canManage,
  fundBalance,
}: {
  userId: string | null;
  canManage: boolean;
  fundBalance: number;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [contribs, setContribs] = useState<Contribution[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", goal: "" });
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "completed">("all");

  async function load() {
    setLoading(true);
    const [{ data: pj }, { data: cs }] = await Promise.all([
      supabase.from("family_projects").select("*").order("created_at", { ascending: false }),
      supabase.from("family_project_contributions").select("*").order("created_at", { ascending: false }),
    ]);
    const projectsData = (pj ?? []) as Project[];
    const contribsData = (cs ?? []) as Contribution[];
    setProjects(projectsData);
    setContribs(contribsData);

    const ids = new Set<string>();
    projectsData.forEach((p) => p.proposed_by && ids.add(p.proposed_by));
    contribsData.forEach((c) => c.contributor_id && ids.add(c.contributor_id));
    if (ids.size > 0) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, arabic_name, full_name")
        .in("id", Array.from(ids));
      const map: Record<string, Profile> = {};
      (ps ?? []).forEach((p) => (map[p.id] = p as Profile));
      setProfiles(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("family-projects-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "family_projects" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "family_project_contributions" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitProposal(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const goal = Number(form.goal);
    if (!form.title.trim()) return toast.error("ادخل عنوان المشروع");
    if (!form.description.trim()) return toast.error("ادخل وصف المشروع");
    if (!goal || goal <= 0) return toast.error("ادخل مبلغًا مستهدفًا صحيحًا");
    const { error } = await supabase.from("family_projects").insert({
      title: form.title.trim(),
      description: form.description.trim(),
      goal_amount: goal,
      proposed_by: userId,
    });
    if (error) return toast.error(error.message);
    toast.success("تم رفع الفكرة، بانتظار موافقة رئيس المجلس");
    setForm({ title: "", description: "", goal: "" });
    setShowForm(false);
  }

  async function approveProject(p: Project) {
    if (!userId) return;
    const raw = prompt(
      `مبلغ الدعم من صندوق العائلة (الرصيد المتاح: ${fmt(fundBalance)} ر.س)\nاكتب 0 للموافقة دون دعم مالي:`,
      "0",
    );
    if (raw === null) return;
    const alloc = Number(raw);
    if (isNaN(alloc) || alloc < 0) return toast.error("مبلغ غير صحيح");
    if (alloc > p.goal_amount) return toast.error("الدعم أكبر من المبلغ المستهدف");
    if (alloc > fundBalance) return toast.error("الدعم يتجاوز رصيد الصندوق المتاح");

    let txId: string | null = null;
    if (alloc > 0) {
      const { data: tx, error: txErr } = await supabase
        .from("fund_transactions")
        .insert({
          type: "expense",
          amount: alloc,
          description: `دعم مشروع: ${p.title}`,
          created_by: userId,
        })
        .select("id")
        .single();
      if (txErr) return toast.error(txErr.message);
      txId = tx.id;
    }

    const { error } = await supabase
      .from("family_projects")
      .update({
        status: "approved",
        fund_allocation: alloc,
        fund_transaction_id: txId,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    if (error) {
      // rollback fund tx
      if (txId) await supabase.from("fund_transactions").delete().eq("id", txId);
      return toast.error(error.message);
    }
    toast.success("تمت الموافقة على المشروع");
  }

  async function rejectProject(p: Project) {
    if (!userId) return;
    const note = prompt("سبب الرفض (اختياري):") ?? "";
    const { error } = await supabase
      .from("family_projects")
      .update({
        status: "rejected",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
      })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("تم رفض المشروع");
  }

  async function markCompleted(p: Project) {
    if (!confirm("تأكيد إنهاء هذا المشروع؟")) return;
    const { error } = await supabase
      .from("family_projects")
      .update({ status: "completed" })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("تم إنهاء المشروع");
  }

  async function removeProject(p: Project) {
    if (!confirm("حذف هذا المشروع نهائيًا؟")) return;
    const { error } = await supabase.from("family_projects").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
  }

  async function contribute(p: Project) {
    if (!userId) return;
    const raw = prompt(`مبلغ التبرع لـ"${p.title}" (ر.س):`);
    if (raw === null) return;
    const amt = Number(raw);
    if (!amt || amt <= 0) return toast.error("مبلغ غير صحيح");
    const { error } = await supabase.from("family_project_contributions").insert({
      project_id: p.id,
      contributor_id: userId,
      amount: amt,
    });
    if (error) return toast.error(error.message);
    toast.success("شكرًا لتبرعك!");
  }

  const enriched = useMemo(() => {
    return projects.map((p) => {
      const cs = contribs.filter((c) => c.project_id === p.id);
      const memberSum = cs.reduce((s, c) => s + Number(c.amount), 0);
      const raised = Number(p.fund_allocation) + memberSum;
      const remaining = Math.max(0, Number(p.goal_amount) - raised);
      const pct = Math.min(100, Math.round((raised / Number(p.goal_amount)) * 100));
      return { p, cs, memberSum, raised, remaining, pct };
    });
  }, [projects, contribs]);

  const filtered = useMemo(() => {
    if (filter === "all") return enriched;
    return enriched.filter((x) => x.p.status === filter);
  }, [enriched, filter]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, completed: 0 };
    projects.forEach((p) => {
      if (p.status in c) (c as any)[p.status]++;
    });
    return c;
  }, [projects]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Actions row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "approved", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition",
                filter === f
                  ? "bg-gold-primary text-navy-base border-gold-primary"
                  : "border-border text-muted-foreground hover:text-ivory",
              )}
            >
              {f === "all" && `الكل (${projects.length})`}
              {f === "pending" && `قيد الانتظار (${counts.pending})`}
              {f === "approved" && `معتمدة (${counts.approved})`}
              {f === "completed" && `مكتملة (${counts.completed})`}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition"
        >
          <Plus className="size-4" />
          {showForm ? "إلغاء" : "اقترح فكرة"}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={submitProposal}
            className="card-surface p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-gold-primary">
              <Sparkles className="size-4" />
              <span className="eyebrow">فكرة مشروع جديد</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="eyebrow block mb-2">عنوان المشروع</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-ivory"
                  required
                />
              </div>
              <div>
                <label className="eyebrow block mb-2">المبلغ المستهدف (ر.س)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.goal}
                  onChange={(e) => setForm({ ...form, goal: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-ivory"
                  required
                />
              </div>
            </div>
            <div>
              <label className="eyebrow block mb-2">وصف المشروع</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-ivory resize-none"
                placeholder="اشرح الفكرة، الهدف منها، وكيف تخدم العائلة..."
                required
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition"
            >
              إرسال للمراجعة
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="card-surface p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <Lightbulb className="size-10 mx-auto text-gold-primary/40 mb-3" />
          <p className="text-muted-foreground text-sm">لا توجد مشاريع في هذا التصنيف</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map(({ p, cs, memberSum, raised, remaining, pct }) => {
            const proposer = p.proposed_by ? profiles[p.proposed_by] : null;
            return (
              <div key={p.id} className="card-surface p-6 space-y-4 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-lg font-bold text-ivory">{p.title}</h4>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      اقتراح: {proposer?.arabic_name || proposer?.full_name || "عضو"}
                      {" · "}
                      {new Date(p.created_at).toLocaleDateString("ar-SA")}
                    </p>
                  </div>
                  {(canManage || (p.status === "pending" && p.proposed_by === userId)) && (
                    <button
                      onClick={() => removeProject(p)}
                      className="text-muted-foreground hover:text-rose-400 transition shrink-0"
                      aria-label="حذف"
                    >
                      <Trash2 className="size-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-4">
                  {p.description}
                </p>

                {p.review_note && p.status === "rejected" && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 rounded-lg p-2">
                    سبب الرفض: {p.review_note}
                  </p>
                )}

                {/* Progress (only meaningful for approved/completed) */}
                {(p.status === "approved" || p.status === "completed") && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Target className="size-3" /> المتبقي للمشروع
                      </span>
                      <span className="font-semibold text-ivory">
                        {fmt(remaining)} <span className="text-[10px] text-muted-foreground">من {fmt(Number(p.goal_amount))} ر.س</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-background overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-700",
                          pct >= 100 ? "bg-emerald-500" : "bg-gradient-to-l from-gold-primary to-emerald-400",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-emerald-400">جُمع {fmt(raised)} ر.س ({pct}%)</span>
                      <span className="text-muted-foreground">
                        صندوق: {fmt(Number(p.fund_allocation))} · أعضاء: {fmt(memberSum)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Contributors */}
                {cs.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-ivory transition">
                      التبرعات ({cs.length})
                    </summary>
                    <ul className="mt-2 space-y-1 pr-2">
                      {cs.map((c) => {
                        const who = c.contributor_id ? profiles[c.contributor_id] : null;
                        return (
                          <li key={c.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{who?.arabic_name || who?.full_name || "عضو"}</span>
                            <span className="text-emerald-400 font-semibold">+{fmt(Number(c.amount))} ر.س</span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 mt-auto">
                  {p.status === "pending" && canManage && (
                    <>
                      <button
                        onClick={() => approveProject(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition"
                      >
                        <Check className="size-3.5" /> موافقة
                      </button>
                      <button
                        onClick={() => rejectProject(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-semibold hover:bg-rose-500/20 transition"
                      >
                        <X className="size-3.5" /> رفض
                      </button>
                    </>
                  )}
                  {p.status === "approved" && (
                    <>
                      <button
                        onClick={() => contribute(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-primary/10 text-gold-primary text-xs font-semibold hover:bg-gold-primary/20 transition"
                      >
                        <HandCoins className="size-3.5" /> ادعم بمبلغ
                      </button>
                      {canManage && remaining === 0 && (
                        <button
                          onClick={() => markCompleted(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition"
                        >
                          <Check className="size-3.5" /> إنهاء
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Project["status"] }) {
  const map: Record<Project["status"], { label: string; cls: string; icon: JSX.Element }> = {
    pending: { label: "قيد الانتظار", cls: "bg-gold-primary/10 text-gold-primary", icon: <Clock className="size-3" /> },
    approved: { label: "معتمد", cls: "bg-emerald-500/10 text-emerald-400", icon: <Check className="size-3" /> },
    rejected: { label: "مرفوض", cls: "bg-rose-500/10 text-rose-400", icon: <X className="size-3" /> },
    completed: { label: "مكتمل", cls: "bg-blue-500/10 text-blue-400", icon: <Check className="size-3" /> },
    cancelled: { label: "ملغى", cls: "bg-muted text-muted-foreground", icon: <X className="size-3" /> },
  };
  const m = map[status];
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1", m.cls)}>
      {m.icon} {m.label}
    </span>
  );
}
