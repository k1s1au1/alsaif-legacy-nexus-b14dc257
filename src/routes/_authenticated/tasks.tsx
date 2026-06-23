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
  Trash2,
  CheckCircle2,
  Loader2,
  Pencil,
  X,
  AlertCircle,
  TrendingUp,
  Award,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
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

type TaskPriority = "low" | "medium" | "high";

type Task = {
  id: string;
  title: string;
  description: string | null;
  progress: number;
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
  low: { label: "عادية", color: "bg-emerald-500", icon: TrendingUp },
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
  const [filter, setFilter] = useState<"all" | "mine" | "todo" | "doing" | "done">("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [tRes, mRes] = await Promise.all([
      supabase.from("tasks").select("*").order("priority", { ascending: false }),
      supabase.from("profiles").select("id, arabic_name, full_name, avatar_url")
    ]);

    const mappedTasks = (tRes.data ?? []).map((t: any) => ({
      ...t,
      progress: t.progress ?? (t.status === 'done' ? 100 : t.status === 'in_progress' ? 40 : 0)
    }));

    setTasks(mappedTasks as Task[]);
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
      const u = uRes.user.id;
      setUserId(u);

      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u),
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
    else if (filter === "todo") list = tasks.filter(t => t.progress === 0);
    else if (filter === "doing") list = tasks.filter(t => t.progress > 0 && t.progress < 100);
    else if (filter === "done") list = tasks.filter(t => t.progress === 100);
    return list;
  }, [tasks, filter, userId]);

  const updateProgress = async (id: string, progress: number) => {
    const { error } = await supabase.from("tasks").update({
      progress,
      status: progress === 100 ? 'done' : progress === 0 ? 'todo' : 'in_progress',
      completed_at: progress === 100 ? new Date().toISOString() : null
    } as any).eq("id", id);

    if (!error) {
      toast.success(`تم تحديث الإنجاز إلى ${progress}%`);
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
    <AppShell title="المسؤوليات" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24" dir="rtl">

        {/* Balanced Theme Header */}
        <section className="relative overflow-hidden rounded-[32px] md:rounded-[60px] bg-gradient-to-br from-primary via-[#1a2b3c] to-primary p-6 md:p-16 text-white shadow-2xl border border-white/5">
           <div className="absolute top-1/2 left-0 -translate-y-1/2 opacity-10 pointer-events-none scale-150 logo-alsaif" style={{ '--logo-url': `url(${alsaifMark.url})` } as any} />

           <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-10">
              <div className="space-y-3 text-center md:text-right">
                 <div className="flex items-center justify-center md:justify-start gap-3">
                    <div className="h-1 w-10 md:w-12 bg-gold-primary rounded-full shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">متابعة الإنجاز</span>
                 </div>
                 <h2 className="text-3xl md:text-7xl font-black tracking-tighter leading-none">مبادرات<br/><span className="text-white/40">السيف</span></h2>
              </div>

              {isPrivileged && (
                <button
                  onClick={() => { setEditingTask(null); setShowDialog(true); }}
                  className="btn-gold px-8 py-3.5 md:px-10 md:py-5 rounded-full text-base md:text-lg font-black shadow-2xl shadow-gold-primary/20 flex items-center gap-3 hover:scale-105 active:scale-95 transition-all group w-full md:w-auto justify-center"
                >
                   <Plus className="group-hover:rotate-90 transition-transform duration-500" />
                   إضافة مبادرة
                </button>
              )}
           </div>
        </section>

        {/* Filters */}
        <section className="px-4 md:px-0">
           <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <FilterTab active={filter === "all"} onClick={() => setFilter("all")} label="الكل" />
              <FilterTab active={filter === "mine"} onClick={() => setFilter("mine")} label="مسؤولياتي" />
              <div className="h-8 w-px bg-border/40 mx-2 hidden md:block" />
              <FilterTab active={filter === "todo"} onClick={() => setFilter("todo")} label="لم تبدأ" />
              <FilterTab active={filter === "doing"} onClick={() => setFilter("doing")} label="قيد التنفيذ" />
              <FilterTab active={filter === "done"} onClick={() => setFilter("done")} label="مكتملة" />
           </div>
        </section>

        {/* Progress Board */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-20">
             <Loader2 className="size-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-4 md:px-0">
             <AnimatePresence mode="popLayout">
                {filteredTasks.map((t) => (
                  <ProgressTaskCard
                    key={t.id}
                    task={t}
                    userId={userId}
                    members={members}
                    onProgressChange={updateProgress}
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

function ProgressTaskCard({ task, userId, members, onProgressChange, onDelete, onEdit, canManage }: any) {
  const priority = priorityConfig[task.priority as TaskPriority];
  const assignee = members.find((m: any) => m.id === task.assignee_id);
  const isAssignee = task.assignee_id === userId;
  const isDone = task.progress === 100;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "relative bg-white dark:bg-[#12141C] border border-border/40 rounded-[32px] md:rounded-[40px] p-6 md:p-8 shadow-xl transition-all hover:shadow-2xl overflow-hidden group",
        isDone && "border-emerald-500/30"
      )}
    >
       <div className="space-y-6 md:space-y-8">
          <div className="flex items-start justify-between">
             <div className={cn("px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm", priority.color.replace('bg-', 'text-').replace('text-', 'border-').replace('border-', 'bg-') + "/10")}>
                {priority.label}
             </div>
             {canManage && (
                <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                   <button onClick={onEdit} className="size-8 md:size-9 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all shadow-sm"><Pencil size={14} /></button>
                   <button onClick={() => onDelete(task.id)} className="size-8 md:size-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"><Trash2 size={14} /></button>
                </div>
             )}
          </div>

          <div className="space-y-2 md:space-y-3">
             <h4 className={cn("text-xl md:text-2xl font-black text-primary leading-tight tracking-tight", isDone && "text-emerald-600")}>{task.title}</h4>
             {task.description && <p className="text-xs md:text-sm font-bold text-muted-foreground leading-relaxed line-clamp-2">{task.description}</p>}
          </div>

          <div className="space-y-5 md:space-y-6">
             <div className="flex items-center justify-between">
                <span className="text-[9px] md:text-[10px] font-black text-primary/40 uppercase tracking-widest">مستوى الإنجاز</span>
                <span className={cn("text-lg md:text-xl font-black tracking-tighter", isDone ? "text-emerald-500" : "text-primary")}>{task.progress}%</span>
             </div>

             {/* Interactive Range Slider */}
             <div className="relative pt-2 pb-6">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={task.progress}
                  disabled={!isAssignee}
                  onChange={(e) => onProgressChange(task.id, parseInt(e.target.value))}
                  className={cn(
                    "w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-gold-primary disabled:opacity-50 disabled:cursor-not-allowed",
                    isDone && "accent-emerald-500"
                  )}
                />
                <div className="flex justify-between mt-3 px-1 text-[8px] font-black text-primary/20">
                   <span>0%</span>
                   <span>50%</span>
                   <span>100%</span>
                </div>
             </div>
          </div>

          <div className="flex items-center justify-between pt-5 md:pt-6 border-t border-border/40">
             {assignee ? (
                <div className="flex items-center gap-2 md:gap-3">
                   <div className="size-8 md:size-10 rounded-xl overflow-hidden border border-background shadow-md ring-1 ring-border/40">
                      <UserAvatar path={assignee.avatar_url} name={assignee.name} className="size-full" userId={assignee.id} />
                   </div>
                   <div className="space-y-0.5">
                      <p className="text-[7px] md:text-[8px] font-black text-muted-foreground uppercase tracking-widest">المكلف</p>
                      <p className="text-[10px] md:text-xs font-black text-primary truncate max-w-[70px] md:max-w-none">{assignee.name}</p>
                   </div>
                </div>
             ) : (
                <div className="flex items-center gap-1.5 text-muted-foreground/30 italic text-[9px] md:text-[10px] font-bold">
                   <X size={10} /> غير مسندة
                </div>
             )}

             <div className="text-left">
                <p className="text-[7px] md:text-[8px] font-black text-muted-foreground uppercase tracking-widest">الموعد</p>
                <p className="text-[10px] md:text-xs font-black text-primary/60">{formatDate(task.due_date)}</p>
             </div>
          </div>
       </div>

       {isDone && (
         <div className="absolute top-4 left-4 size-7 md:size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <Award size={16} />
         </div>
       )}
    </motion.article>
  );
}

function FilterTab({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-5 py-2 md:px-8 md:py-4 rounded-2xl md:rounded-3xl text-[10px] md:text-xs font-black transition-all border",
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
    progress: task?.progress ?? 0,
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
      status: form.progress === 100 ? 'done' : form.progress === 0 ? 'todo' : 'in_progress',
      assignee_id: form.assignee_id === "none" ? null : form.assignee_id,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      completed_at: form.progress === 100 ? new Date().toISOString() : null,
    };
    let error;
    if (task) {
      ({ error } = await supabase.from("tasks").update(payload as any).eq("id", task.id));
    } else {
      ({ error } = await supabase.from("tasks").insert({ ...payload, created_by: userId } as any));

    }
    setSaving(false);
    if (!error) { toast.success("تم الحفظ بنجاح"); onSaved(); onClose(); }
    else { toast.error("فشل الحفظ: " + error.message); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4 bg-black/90 backdrop-blur-2xl" dir="rtl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#0F1116] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-14 space-y-8 md:space-y-10 shadow-2xl rounded-[32px] md:rounded-[60px] relative custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
         <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-[#0F1116] z-10 pb-4 border-b border-border/20">
            <h3 className="text-2xl md:text-3xl font-black text-primary tracking-tight">{task ? "تعديل المبادرة" : "مبادرة جديدة"}</h3>
            <button onClick={onClose} className="size-10 md:size-12 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-white transition-all"><X size={20} /></button>
         </div>

         <form onSubmit={submit} className="space-y-6 md:space-y-8">
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">عنوان المبادرة</label>
               <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="ما هي المهمة؟" className="w-full h-12 md:h-16 px-5 md:px-8 rounded-2xl md:rounded-3xl bg-muted/30 border border-border/60 font-bold text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner" required />
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">التفاصيل والأهداف</label>
               <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="أدخل وصفاً تفصيلياً..." rows={3} className="w-full p-5 md:p-8 rounded-2xl md:rounded-3xl bg-muted/30 border border-border/60 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none shadow-inner" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">المستوى</label>
                  <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as any})} className="w-full h-12 md:h-16 px-5 md:px-8 rounded-2xl md:rounded-3xl bg-muted/30 border border-border/60 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner">
                     <option value="low">عادية</option>
                     <option value="medium">متوسطة الأهمية</option>
                     <option value="high">عاجلة جداً</option>
                  </select>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">تاريخ الإنجاز</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="w-full h-12 md:h-16 px-5 md:px-8 rounded-2xl md:rounded-3xl bg-muted/30 border border-border/60 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner" />
               </div>
               <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">المسؤول عن التنفيذ</label>
                  <select value={form.assignee_id} onChange={e => setForm({...form, assignee_id: e.target.value})} className="w-full h-12 md:h-16 px-5 md:px-8 rounded-2xl md:rounded-3xl bg-muted/30 border border-border/60 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner">
                     <option value="none">— اختر الفرد المسؤول —</option>
                     {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
               </div>
            </div>

            <div className="flex gap-4 pt-4 md:pt-8 sticky bottom-0 bg-white dark:bg-[#0F1116] py-4 border-t border-border/20">
               <button type="button" onClick={onClose} className="flex-1 py-4 md:py-6 rounded-2xl md:rounded-[32px] font-black text-muted-foreground hover:bg-muted transition-all">تراجع</button>
               <button disabled={saving} type="submit" className="flex-[2] btn-gold py-4 md:py-6 rounded-2xl md:rounded-[32px] font-black text-base md:text-xl shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3">
                 {saving ? <Loader2 className="size-6 animate-spin" /> : <span>تأكيد المبادرة</span>}
               </button>
            </div>
         </form>
      </motion.div>
    </div>
  );
}
