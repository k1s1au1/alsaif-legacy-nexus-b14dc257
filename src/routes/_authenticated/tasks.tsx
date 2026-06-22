import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import {
  ListChecks,
  Plus,
  Calendar as CalendarIcon,
  Clock,
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
  Check,
  AlertCircle,
  GripVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { toast } from "sonner";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";

export const Route = createFileRoute("/_authenticated/tasks")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "المسؤوليات — السيف" },
      { name: "description", content: "إدارة مهام ومسؤوليات أعضاء عائلة السيف." },
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

const priorityConfig: Record<TaskPriority, { label: string; color: string; icon: any }> = {
  low: { label: "عادية", color: "bg-emerald-500", icon: Check },
  medium: { label: "متوسطة", color: "bg-amber-500", icon: Clock },
  high: { label: "عاجلة", color: "bg-rose-500", icon: AlertCircle },
};

function formatDate(iso: string | null) {
  if (!iso) return "بدون موعد";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
  } catch { return "—"; }
}

function TasksPage() {
  const [profile, setProfile] = useState({ name: "...", role: "عضو", initial: "ص", avatarPath: null as string | null });
  const [userId, setUserId] = useState<string | null>(null);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "mine" | TaskStatus>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [tRes, mRes] = await Promise.all([
      supabase.from("tasks").select("*").order("priority", { ascending: false }),
      supabase.from("profiles").select("id, arabic_name, full_name, avatar_url")
    ]);

    setTasks((tRes.data ?? []) as Task[]);
    setMembers((mRes.data ?? []).map(p => ({
      id: p.id,
      name: p.arabic_name || p.full_name || "عضو",
      avatar_url: p.avatar_url
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: uRes } = await supabase.auth.getUser();
      if (!uRes.user) return;
      const u = uRes.user;
      setUserId(u.id);

      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.id),
      ]);

      const r = (roles ?? []).map(x => x.role);
      setIsPrivileged(r.includes("admin") || r.includes("manager"));

      const name = p?.arabic_name || p?.full_name || "عضو";
      setProfile({
        name,
        role: r.includes("admin") ? "مسؤول النظام" : r.includes("manager") ? "مدير" : "عضو",
        initial: name[0].toUpperCase(),
        avatarPath: p?.avatar_url ?? null
      });

      await loadAll();
    })();
  }, [loadAll]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (filter === "mine") list = tasks.filter(t => t.assignee_id === userId);
    else if (filter !== "all") list = tasks.filter(t => t.status === filter);
    return list;
  }, [tasks, filter, userId]);

  const updateStatus = async (id: string, status: TaskStatus) => {
    const { error } = await supabase.from("tasks").update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null
    }).eq("id", id);
    if (!error) {
      toast.success("تم تحديث حالة المهمة");
      loadAll();
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (!error) {
      toast.success("تم حذف المهمة");
      loadAll();
    }
  };

  return (
    <AppShell title="المهام" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24" dir="rtl">

        {/* Radical Header */}
        <section className="relative overflow-hidden rounded-[40px] md:rounded-[60px] bg-primary p-8 md:p-16 text-white shadow-2xl">
           <div className="absolute inset-0 bg-gradient-to-br from-primary via-[#1a2b3c] to-black z-0" />
           <div className="absolute top-1/2 left-0 -translate-y-1/2 opacity-10 pointer-events-none scale-150 logo-alsaif" style={{ '--logo-url': `url(${alsaifMark.url})` } as any} />

           <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="space-y-4 text-center md:text-right">
                 <div className="flex items-center justify-center md:justify-start gap-3">
                    <div className="h-1 w-12 bg-gold-primary rounded-full shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">مركز المهام</span>
                 </div>
                 <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-none">مبادرات<br/><span className="text-white/40">آل سيف</span></h2>
              </div>

              {isPrivileged && (
                <button
                  onClick={() => { setEditingTask(null); setShowDialog(true); }}
                  className="btn-gold px-10 py-5 rounded-full text-lg font-black shadow-2xl shadow-gold-primary/20 flex items-center gap-3 hover:scale-105 active:scale-95 transition-all group"
                >
                   <Plus className="group-hover:rotate-90 transition-transform duration-500" />
                   إضافة مهمة
                </button>
              )}
           </div>
        </section>

        {/* Filters & Interactive Nav */}
        <section className="px-4 md:px-0">
           <div className="flex flex-wrap items-center gap-3">
              <FilterTab active={filter === "all"} onClick={() => setFilter("all")} label="كافة المبادرات" />
              <FilterTab active={filter === "mine"} onClick={() => setFilter("mine")} label="مسؤولياتي" />
              <div className="h-8 w-px bg-border/40 mx-2 hidden md:block" />
              <FilterTab active={filter === "todo"} onClick={() => setFilter("todo")} label="الانتظار" />
              <FilterTab active={filter === "in_progress"} onClick={() => setFilter("in_progress")} label="قيد التنفيذ" />
              <FilterTab active={filter === "done"} onClick={() => setFilter("done")} label="المكتملة" />
           </div>
        </section>

        {/* Board Style List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-20">
             <Loader2 className="size-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 md:px-0">
             <AnimatePresence mode="popLayout">
                {filteredTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    userId={userId}
                    members={members}
                    onStatusChange={updateStatus}
                    onDelete={deleteTask}
                    onEdit={() => { setEditingTask(t); setShowDialog(true); }}
                    canManage={isPrivileged || t.created_by === userId}
                  />
                ))}
             </AnimatePresence>
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
            onSaved={loadAll}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function TaskCard({ task, userId, members, onStatusChange, onDelete, onEdit, canManage }: any) {
  const priority = priorityConfig[task.priority as TaskPriority];
  const assignee = members.find((m: any) => m.id === task.assignee_id);
  const isAssignee = task.assignee_id === userId;
  const isDone = task.status === "done";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "relative group bg-white dark:bg-card border border-border/40 rounded-[32px] p-6 shadow-xl transition-all hover:shadow-2xl overflow-hidden",
        isDone && "opacity-60 grayscale-[0.5]"
      )}
    >
       {/* Priority Strip */}
       <div className={cn("absolute top-0 right-0 w-2 bottom-0", priority.color)} />

       <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
             <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border/40">
                <priority.icon size={10} className={priority.color.replace('bg-', 'text-')} />
                <span className="text-[10px] font-black uppercase tracking-widest">{priority.label}</span>
             </div>
             {canManage && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={onEdit} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><Pencil size={14} /></button>
                   <button onClick={() => onDelete(task.id)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors"><Trash2 size={14} /></button>
                </div>
             )}
          </div>

          <div className="space-y-2">
             <h4 className={cn("text-xl font-black text-primary leading-tight tracking-tight", isDone && "line-through")}>{task.title}</h4>
             {task.description && <p className="text-sm font-bold text-muted-foreground leading-relaxed line-clamp-2">{task.description}</p>}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border/40">
             <div className="flex items-center gap-3">
                {assignee ? (
                  <div className="flex items-center gap-2 pr-1 pl-3 py-1 bg-primary/5 rounded-full border border-primary/10">
                     <div className="size-6 rounded-full overflow-hidden border-2 border-white shadow-sm">
                        <UserAvatar path={assignee.avatar_url} name={assignee.name} className="size-full" userId={assignee.id} />
                     </div>
                     <span className="text-[10px] font-black text-primary truncate max-w-[80px]">{assignee.name}</span>
                  </div>
                ) : (
                  <span className="text-[10px] font-black text-muted-foreground/40 italic">غير مسندة</span>
                )}
             </div>

             <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground opacity-60">
                <CalendarIcon size={12} />
                <span>{formatDate(task.due_date)}</span>
             </div>
          </div>

          {/* Action Button */}
          <button
            onClick={() => {
               if (!isAssignee) {
                 toast.info("فقط المكلف بالمهمة يمكنه تغيير حالتها");
                 return;
               }
               const next: TaskStatus = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
               onStatusChange(task.id, next);
            }}
            className={cn(
              "w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-xs transition-all border-2",
              isDone ? "bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20" :
              task.status === "in_progress" ? "bg-amber-500 border-amber-500 text-white shadow-amber-500/20" :
              "bg-white dark:bg-black/20 border-border hover:border-primary text-primary"
            )}
          >
             {isDone ? <CheckCircle2 size={18} /> : task.status === "in_progress" ? <Loader2 size={18} className="animate-spin" /> : <Circle size={18} />}
             <span>{isDone ? "تمت المهمة" : task.status === "in_progress" ? "جاري العمل" : "ابدأ المهمة"}</span>
          </button>
       </div>
    </motion.article>
  );
}

function FilterTab({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-3 rounded-full text-xs font-black transition-all border",
        active ? "bg-primary text-white border-primary shadow-xl shadow-primary/20 scale-105" : "bg-white dark:bg-card border-border/60 text-muted-foreground hover:bg-muted"
      )}
    >
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
            <h3 className="text-3xl font-black text-primary tracking-tight">{task ? "تعديل المسؤولية" : "مبادرة جديدة"}</h3>
            <button onClick={onClose} className="size-12 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-white transition-all"><X size={20} /></button>
         </div>

         <form onSubmit={submit} className="space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">عنوان المبادرة</label>
               <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="ما هي المهمة؟" className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all" />
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">التفاصيل والأهداف</label>
               <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="أدخل وصفاً تفصيلياً..." rows={3} className="w-full p-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">المستوى</label>
                  <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as any})} className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all">
                     <option value="low">عادية</option>
                     <option value="medium">متوسطة الأهمية</option>
                     <option value="high">عاجلة جداً</option>
                  </select>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">تاريخ الإنجاز</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all" />
               </div>
               <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">المسؤول عن التنفيذ</label>
                  <select value={form.assignee_id} onChange={e => setForm({...form, assignee_id: e.target.value})} className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all">
                     <option value="none">— اختر الفرد المسؤول —</option>
                     {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
               </div>
            </div>

            <div className="flex gap-4 pt-6">
               <button type="button" onClick={onClose} className="flex-1 py-5 rounded-3xl font-black text-muted-foreground hover:bg-muted transition-all">تراجع</button>
               <button disabled={saving} type="submit" className="flex-[2] btn-gold py-5 rounded-3xl font-black text-lg shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3">
                 {saving ? <Loader2 className="size-6 animate-spin" /> : <span>تأكيد المبادرة</span>}
               </button>
            </div>
         </form>
      </motion.div>
    </div>
  );
}
