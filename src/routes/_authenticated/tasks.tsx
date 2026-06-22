import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import {
  ListChecks,
  Plus,
  Calendar as CalendarIcon,
  Flag,
  Trash2,
  CheckCircle2,
  Circle,
  Loader2,
  Pencil,
  Filter,
  X,
  ChevronLeft,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";

export const Route = createFileRoute("/_authenticated/tasks")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "المهام — السيف" },
      { name: "description", content: "مهام ومسؤوليات أعضاء العائلة." },
    ],
  }),
  component: TasksPage,
});

type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  created_by: string;
  completed_at: string | null;
  created_at: string;
};

type Member = {
  id: string;
  name: string;
  avatar_url: string | null;
};

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  return "عضو";
}

const statusLabels: Record<TaskStatus, string> = {
  todo: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  done: "مكتملة",
};

const priorityLabels: Record<TaskPriority, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
};

const priorityStyles: Record<TaskPriority, string> = {
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  medium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  high: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "—";
  }
}

function TasksPage() {
  const [profile, setProfile] = useState({
    name: "...",
    role: "...",
    initial: "ص",
    avatarPath: null as string | null,
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "mine" | TaskStatus>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const memberMap = useMemo(() => {
    const m = new Map<string, Member>();
    members.forEach((mb) => m.set(mb.id, mb));
    return m;
  }, [members]);

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id, arabic_name, full_name, avatar_url").order("arabic_name");
    setMembers((data ?? []).map((p) => ({
      id: p.id,
      name: p.arabic_name?.trim() || p.full_name?.trim() || "عضو",
      avatar_url: p.avatar_url ?? null,
    })));
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user || !mounted) return;
        setUserId(u.user.id);

        const [{ data: p }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", u.user.id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        ]);

        if (!mounted) return;

        const r = (roles ?? []).map((x) => x.role);
        setIsPrivileged(r.includes("admin") || r.includes("manager"));

        const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو";
        const char = name ? name[0] : "ع";

        setProfile({
          name,
          role: roleLabel(r[0] || null),
          initial: (char || "ع").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
        });

        await Promise.all([loadMembers(), loadTasks()]);
      } catch (err) {
        console.error("Tasks init failed:", err);
      }
    })();
    return () => { mounted = false; };
  }, [loadMembers, loadTasks]);


  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks;
    if (filter === "mine") return tasks.filter((t) => t.assignee_id === userId);
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter, userId]);

  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter(t => t.status === "todo").length,
    doing: tasks.filter(t => t.status === "in_progress").length,
    mine: tasks.filter(t => t.assignee_id === userId && t.status !== "done").length,
  }), [tasks, userId]);

  async function quickToggle(task: Task) {
    const next: TaskStatus = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
    const { error } = await supabase.from("tasks").update({
      status: next,
      completed_at: next === "done" ? new Date().toISOString() : null
    }).eq("id", task.id);
    if (!error) {
      toast.success("تم تحديث حالة المهمة");
      loadTasks();
    }
  }

  async function deleteTask(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذه المهمة؟")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (!error) {
      toast.success("تم حذف المهمة");
      loadTasks();
    }
  }

  return (
    <AppShell title="المهام" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24" dir="rtl">

        {/* Royal Tasks Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-up">
           <div className="space-y-2">
              <div className="flex items-center gap-3">
                 <div className="size-1 w-10 bg-gold-primary rounded-full" />
                 <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">إدارة المسؤوليات</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight text-primary">المهام العائلية</h2>
              <p className="text-muted-foreground font-bold text-lg opacity-70">نظّم ووزع المسؤوليات بين أعضاء المجلس بكل كفاءة.</p>
           </div>
           <button
             onClick={() => { setEditingTask(null); setShowDialog(true); }}
             className="btn-gold px-8 py-4 flex items-center gap-3 shadow-2xl shadow-gold-primary/20 text-base"
           >
              <Plus className="size-5" strokeWidth={3} />
              <span>إضافة مهمة جديدة</span>
           </button>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
           <StatCard label="إجمالي المهام" value={stats.total} icon={<ListChecks />} />
           <StatCard label="قيد الانتظار" value={stats.todo} icon={<Circle />} color="muted" />
           <StatCard label="تحت التنفيذ" value={stats.doing} icon={<Loader2 className="animate-spin-slow" />} color="amber" />
           <StatCard label="مهامي النشطة" value={stats.mine} icon={<LayoutGrid />} color="gold" />
        </section>

        {/* Tabs Filter */}
        <section className="flex overflow-x-auto no-scrollbar items-center gap-3 p-1.5 bg-muted/30 rounded-[32px] border border-border/40 w-fit animate-fade-up" style={{ animationDelay: "200ms" }}>
           <NavTab active={filter === "all"} onClick={() => setFilter("all")} label="الكل" />
           <NavTab active={filter === "mine"} onClick={() => setFilter("mine")} label="مهامي" />
           <NavTab active={filter === "todo"} onClick={() => setFilter("todo")} label="بانتظار البدء" />
           <NavTab active={filter === "in_progress"} onClick={() => setFilter("in_progress")} label="جاري العمل" />
           <NavTab active={filter === "done"} onClick={() => setFilter("done")} label="المكتملة" />
        </section>

        {/* Tasks List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-30">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="card-surface p-24 flex flex-col items-center text-center gap-6 border-dashed opacity-40">
             <ListChecks size={60} strokeWidth={1} />
             <p className="text-xl font-bold">لا توجد مهام في هذا القسم حالياً</p>
          </div>
        ) : (
          <div className="grid gap-4 animate-fade-up" style={{ animationDelay: "300ms" }}>
            {filteredTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                assignee={task.assignee_id ? memberMap.get(task.assignee_id) : null}
                onToggle={() => quickToggle(task)}
                onEdit={() => { setEditingTask(task); setShowDialog(true); }}
                onDelete={() => deleteTask(task.id)}
                canManage={isPrivileged || task.created_by === userId}
              />
            ))}
          </div>
        )}

      </div>

      <AnimatePresence>
        {showDialog && (
          <TaskDialog
            task={editingTask}
            members={members}
            userId={userId}
            onClose={() => setShowDialog(false)}
            onSaved={loadTasks}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function TaskRow({ task, assignee, onToggle, onEdit, onDelete, canManage }: any) {
  const isDone = task.status === "done";

  return (
    <motion.div layout className={cn("card-surface p-6 md:p-8 hover:bg-primary/5 transition-all group border-none shadow-xl", isDone && "opacity-60")}>
       <div className="flex items-start gap-6">
          <button
            onClick={onToggle}
            className={cn("mt-1 size-7 rounded-full border-2 flex items-center justify-center transition-all",
              isDone ? "bg-emerald-500 border-emerald-500 text-white" :
              task.status === "in_progress" ? "border-amber-500 text-amber-500" :
              "border-border text-transparent hover:border-primary")}
          >
             <CheckCircle2 size={16} strokeWidth={3} />
          </button>

          <div className="flex-1 min-w-0 space-y-4">
             <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                   <h4 className={cn("text-xl font-black text-primary tracking-tight", isDone && "line-through")}>{task.title}</h4>
                   {task.description && <p className="text-sm font-bold text-muted-foreground leading-relaxed">{task.description}</p>}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={onEdit} className="size-9 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-primary hover:text-white transition-all"><Pencil size={14} /></button>
                     <button onClick={onDelete} className="size-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={14} /></button>
                  </div>
                )}
             </div>

             <div className="flex flex-wrap items-center gap-4">
                <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border", priorityStyles[task.priority])}>
                   {priorityLabels[task.priority]}
                </div>
                {task.due_date && (
                   <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground opacity-60 uppercase">
                      <Clock size={12} /> {formatDate(task.due_date)}
                   </div>
                )}
                <div className="flex-1" />
                {assignee && (
                  <div className="flex items-center gap-2 bg-white/40 dark:bg-black/20 pr-1 pl-4 py-1 rounded-full border border-border/40 shadow-sm">
                     <div className="size-6 rounded-full overflow-hidden border border-border shadow-inner bg-muted">
                        <UserAvatar path={assignee.avatar_url} name={assignee.name} className="size-full" userId={assignee.id} />
                     </div>
                     <span className="text-[11px] font-black text-primary">{assignee.name}</span>
                  </div>
                )}
             </div>
          </div>
       </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon, color }: any) {
  const styles: any = {
    gold: "text-gold-primary bg-gold-primary/5 border-gold-primary/20",
    amber: "text-amber-500 bg-amber-500/5 border-amber-500/20",
    muted: "text-muted-foreground bg-muted/30 border-border/40",
    default: "text-primary bg-primary/5 border-primary/20",
  };
  return (
    <div className={cn("card-surface p-6 border flex flex-col gap-4 shadow-lg transition-transform hover:-translate-y-1", styles[color] || styles.default)}>
       <div className="size-10 rounded-2xl bg-white/50 dark:bg-black/20 flex items-center justify-center shadow-inner">{icon}</div>
       <div>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
          <p className="text-3xl font-black tracking-tight mt-1">{value}</p>
       </div>
    </div>
  );
}

function NavTab({ active, onClick, label }: any) {
  return (
    <button onClick={onClick} className={cn("px-6 py-3 rounded-full text-xs font-black transition-all whitespace-nowrap", active ? "bg-primary text-white shadow-xl shadow-primary/20" : "text-muted-foreground hover:text-primary hover:bg-white")}>
       {label}
    </button>
  );
}

function TaskDialog({ task, members, userId, onClose, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "todo",
    priority: task?.priority ?? "medium",
    due_date: task?.due_date ? task.due_date.slice(0, 10) : "",
    assignee_id: task?.assignee_id ?? "none",
  });

  const submit = async (e: any) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      assignee_id: form.assignee_id === "none" ? null : form.assignee_id,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      completed_at: form.status === "done" ? new Date().toISOString() : null,
    };
    let error;
    if (task) {
      ({ error } = await supabase.from("tasks").update(payload).eq("id", task.id));
    } else {
      ({ error } = await supabase.from("tasks").insert({ ...payload, created_by: userId }));
    }
    setSaving(false);
    if (!error) { toast.success("تم الحفظ"); onSaved(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-surface w-full max-w-2xl p-8 sm:p-12 space-y-8 shadow-2xl rounded-[48px]">
         <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black text-primary tracking-tight">{task ? "تعديل المهمة" : "إضافة مهمة جديدة"}</h3>
            <button onClick={onClose} className="size-12 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-white transition-all"><X size={20} /></button>
         </div>

         <form onSubmit={submit} className="space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">عنوان المهمة</label>
               <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="مثال: تجهيز استراحة الجمعة" className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all" />
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">التفاصيل</label>
               <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="أدخل تفاصيل إضافية للمهمة..." rows={3} className="w-full p-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <SelectField label="الحالة" value={form.status} onChange={v => setForm({...form, status: v})} options={[{v:"todo", l:"بانتظار البدء"}, {v:"in_progress", l:"جاري التنفيذ"}, {v:"done", l:"مكتملة"}]} />
               <SelectField label="الأولوية" value={form.priority} onChange={v => setForm({...form, priority: v})} options={[{v:"low", l:"منخفضة"}, {v:"medium", l:"متوسطة"}, {v:"high", l:"عالية"}]} />
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">تاريخ الاستحقاق</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all" />
               </div>
               <SelectField label="المسند إليه" value={form.assignee_id} onChange={v => setForm({...form, assignee_id: v})} options={[{v:"none", l:"— غير معيّن —"}, ...members.map((m:any)=>({v:m.id, l:m.name}))]} />
            </div>

            <div className="flex gap-4 pt-6">
               <button type="button" onClick={onClose} className="flex-1 py-5 rounded-3xl font-black text-muted-foreground hover:bg-muted transition-all">إلغاء</button>
               <button disabled={saving} type="submit" className="flex-[2] btn-gold py-5 rounded-3xl font-black text-lg shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3">
                 {saving ? <Loader2 className="size-6 animate-spin" /> : <span>تأكيد المهمة</span>}
               </button>
            </div>
         </form>
      </motion.div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: any) {
  return (
    <div className="space-y-2">
       <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">{label}</label>
       <select value={value} onChange={e => onChange(e.target.value)} className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all">
          {options.map((o:any) => <option key={o.v} value={o.v}>{o.l}</option>)}
       </select>
    </div>
  );
}
