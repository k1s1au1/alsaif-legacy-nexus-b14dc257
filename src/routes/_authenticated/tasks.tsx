import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
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
import { useSiteLogo } from "@/hooks/use-site-logo";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";

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
  const { userId, isAdmin, isManager, isChairman, isLoading: rolesLoading, canManage: canManageSection, primaryRole } = useUserRole();
  const isPrivileged = isAdmin || isManager || isChairman;
  const dynamicLogo = useSiteLogo();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "mine" | "todo" | "doing" | "done">("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [tRes, mRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
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
      if (userId) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
        const name = p?.arabic_name || p?.full_name || "عضو";
        setProfile({
          name,
          role: roleLabel(primaryRole),
          initial: name[0].toUpperCase(),
          avatarPath: p?.avatar_url ?? null
        });
      }
      await loadAll();
    })();
  }, [loadAll, userId, primaryRole]);

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
      setTasks(prev => prev.map(t => t.id === id ? { ...t, progress, status: progress === 100 ? 'done' : 'in_progress' } as Task : t));
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المهمة؟")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (!error) {
      toast.success("تم حذف المهمة");
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  return (
    <AppShell title="المسؤوليات" user={profile}>
      <div className="max-w-7xl mx-auto space-y-12 pb-24 px-4 md:px-0" dir="rtl">
        <QuickActionsBanner />

        {/* Dynamic Header */}
        <section className="relative overflow-hidden rounded-[40px] md:rounded-[64px] bg-[#064E3B] p-8 md:p-20 text-white shadow-2xl group border border-white/5">
           <div className="absolute inset-0 bg-gradient-to-br from-[#064E3B] via-[#0A5A3E] to-black opacity-90 z-0" />
           <div className="absolute top-1/2 left-0 -translate-y-1/2 opacity-10 pointer-events-none scale-150 logo-alsaif z-1" style={{ '--logo-url': `url(${dynamicLogo || alsaifMark.url})` } as any} />
           <div className="absolute -top-24 -right-24 size-96 bg-gold-primary/10 rounded-full blur-[100px] pointer-events-none group-hover:scale-110 transition-transform duration-1000" />

           <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="space-y-4 text-center md:text-right">
                 <div className="flex items-center justify-center md:justify-start gap-3">
                    <div className="h-1 w-12 bg-gold-primary rounded-full shadow-[0_0_20px_rgba(212,175,55,0.6)]" />
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">نظام إدارة المهام</span>
                 </div>
                 <h2 className="text-4xl md:text-8xl font-black tracking-tighter leading-none">مبادرات<br/><span className="text-white/30">آل سيف</span></h2>
                 <p className="text-white/60 font-bold text-lg md:text-2xl max-w-xl">تعاون، أنجز، وارتقِ بمسؤوليات عائلتنا العريقة.</p>
              </div>

              {isPrivileged && (
                <button
                  onClick={() => { setEditingTask(null); setShowDialog(true); }}
                  className="btn-gold px-10 py-5 md:px-14 md:py-7 rounded-[32px] text-lg md:text-xl font-black shadow-2xl shadow-gold-primary/30 flex items-center gap-4 hover:scale-105 active:scale-95 transition-all group w-full md:w-auto justify-center"
                >
                   <Plus className="size-6 group-hover:rotate-90 transition-transform duration-500" strokeWidth={3} />
                   إضافة مبادرة جديدة
                </button>
              )}
           </div>
        </section>

        {/* Board View Wrapper */}
        <div className="space-y-10">
           {/* Navigation & Stats */}
           <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-[28px] border border-border/40 overflow-x-auto no-scrollbar w-full md:w-auto">
                 <FilterTab active={filter === "all"} onClick={() => setFilter("all")} label="الكل" count={tasks.length} />
                 <FilterTab active={filter === "mine"} onClick={() => setFilter("mine")} label="مسؤولياتي" count={tasks.filter(t => t.assignee_id === userId).length} />
                 <div className="h-6 w-px bg-border/40 mx-2" />
                 <FilterTab active={filter === "todo"} onClick={() => setFilter("todo")} label="قيد الانتظار" color="bg-slate-500" />
                 <FilterTab active={filter === "doing"} onClick={() => setFilter("doing")} label="جارية" color="bg-blue-500" />
                 <FilterTab active={filter === "done"} onClick={() => setFilter("done")} label="مكتملة" color="bg-emerald-500" />
              </div>

              <div className="flex items-center gap-6 px-6">
                 <div className="text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">معدل الإنجاز</p>
                    <p className="text-2xl font-black text-primary tracking-tighter">
                       {tasks.length > 0 ? Math.round((tasks.filter(t => t.progress === 100).length / tasks.length) * 100) : 0}%
                    </p>
                 </div>
                 <div className="size-12 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary border border-gold-primary/20">
                    <Award className="size-6" />
                 </div>
              </div>
           </div>

           {/* Tasks Grid */}
           {loading ? (
             <div className="flex flex-col items-center justify-center py-40 opacity-20">
                <Loader2 className="size-16 animate-spin text-primary" strokeWidth={3} />
                <p className="mt-4 font-black tracking-widest text-xs uppercase">جاري مزامنة اللوحة...</p>
             </div>
           ) : filteredTasks.length === 0 ? (
             <div className="card-surface p-24 md:p-40 flex flex-col items-center text-center gap-8 border-dashed border-4 opacity-40 rounded-[56px] bg-muted/20">
                <ListChecks size={80} className="text-muted-foreground opacity-20" />
                <div className="space-y-2">
                   <p className="text-3xl font-black text-primary">لا توجد مبادرات حالياً</p>
                   <p className="text-lg font-bold opacity-60">جميع المهام مكتملة أو لم يتم تعيين أي مهام في هذا التصنيف.</p>
                </div>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <AnimatePresence mode="popLayout">
                   {filteredTasks.map((t, idx) => (
                     <ModernTaskCard
                       key={t.id}
                       task={t}
                       index={idx}
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

function ModernTaskCard({ task, index, userId, members, onProgressChange, onDelete, onEdit, canManage }: any) {
  const priority = priorityConfig[task.priority as TaskPriority];
  const assignee = members.find((m: any) => m.id === task.assignee_id);
  const isAssignee = task.assignee_id === userId;
  const isDone = task.progress === 100;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.9, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "group relative bg-white dark:bg-[#0D0F14] border-2 border-border/30 rounded-[44px] p-8 md:p-10 shadow-2xl transition-all duration-500 hover:border-gold-primary/30 hover:shadow-gold-primary/5",
        isDone && "border-emerald-500/20 bg-emerald-500/[0.02]"
      )}
    >
       <div className="space-y-8">
          <header className="flex items-start justify-between">
             <div className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm flex items-center gap-2", priority.color.replace('bg-', 'text-').replace('text-', 'border-').replace('border-', 'bg-') + "/10")}>
                <span className={cn("size-1.5 rounded-full animate-pulse", priority.color)} />
                {priority.label}
             </div>
             {canManage && (
                <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300">
                   <button onClick={onEdit} className="size-10 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all shadow-sm"><Pencil size={16} /></button>
                   <button onClick={() => onDelete(task.id)} className="size-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"><Trash2 size={16} /></button>
                </div>
             )}
          </header>

          <div className="space-y-3">
             <h4 className={cn("text-2xl md:text-3xl font-black text-primary leading-[1.1] tracking-tight transition-colors", isDone && "text-emerald-600")}>{task.title}</h4>
             {task.description && <p className="text-sm md:text-base font-bold text-muted-foreground leading-relaxed line-clamp-3 opacity-70 group-hover:opacity-100 transition-opacity">{task.description}</p>}
          </div>

          <div className="space-y-6">
             <div className="flex items-end justify-between">
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">مرحلة الإنجاز</p>
                   <p className={cn("text-lg font-black tracking-tighter",
                     isDone ? "text-emerald-500" :
                     task.progress >= 80 ? "text-amber-500" :
                     task.progress >= 40 ? "text-blue-500" : "text-primary"
                   )}>
                     {isDone ? "مكتملة" :
                      task.progress >= 80 ? "قيد المراجعة" :
                      task.progress >= 40 ? "قيد التنفيذ" : "بانتظار البدء"}
                   </p>
                </div>
                <span className={cn("text-3xl font-black tracking-tighter leading-none", isDone ? "text-emerald-500" : "text-primary")}>{task.progress}%</span>
             </div>

             {/* Functional Professional Toggle */}
             <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-2xl border border-border/10">
                <StatusStep
                  active={task.progress === 0}
                  disabled={!isAssignee}
                  onClick={() => onProgressChange(task.id, 0)}
                  label="انتظار"
                />
                <StatusStep
                  active={task.progress > 0 && task.progress < 80}
                  disabled={!isAssignee}
                  onClick={() => onProgressChange(task.id, 40)}
                  label="تنفيذ"
                />
                <StatusStep
                  active={task.progress >= 80 && task.progress < 100}
                  disabled={!isAssignee}
                  onClick={() => onProgressChange(task.id, 80)}
                  label="مراجعة"
                />
                <StatusStep
                  active={isDone}
                  disabled={!isAssignee}
                  onClick={() => onProgressChange(task.id, 100)}
                  label="إكمال"
                />
             </div>
          </div>

          <div className="flex items-center justify-between pt-8 border-t border-border/40">
             {assignee ? (
                <div className="flex items-center gap-3">
                   <div className="size-12 rounded-[18px] overflow-hidden border-2 border-white shadow-xl ring-1 ring-border/20 group-hover:scale-110 transition-transform">
                      <UserAvatar path={assignee.avatar_url} name={assignee.name} className="size-full" userId={assignee.id} />
                   </div>
                   <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-50">المسؤول</p>
                      <p className="text-xs font-black text-primary">{assignee.name}</p>
                   </div>
                </div>
             ) : (
                <div className="flex items-center gap-2 text-muted-foreground/30 italic text-[10px] font-black uppercase tracking-widest">
                   <X size={12} strokeWidth={3} /> بانتظار تكليف
                </div>
             )}

             <div className="text-left bg-muted/30 px-4 py-2 rounded-2xl border border-border/20">
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-50">الاستحقاق</p>
                <div className="flex items-center gap-2">
                   <Clock className="size-3 text-gold-primary" />
                   <span className="text-xs font-black text-primary/80">{formatDate(task.due_date)}</span>
                </div>
             </div>
          </div>
       </div>

       {isDone && (
         <motion.div
           initial={{ scale: 0 }}
           animate={{ scale: 1 }}
           className="absolute -top-4 -left-4 size-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xl border-4 border-white dark:border-[#0D0F14] z-20"
         >
            <Check size={28} strokeWidth={4} />
         </motion.div>
       )}
    </motion.article>
  );
}

function FilterTab({ active, onClick, label, count, color }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-3 rounded-2xl md:rounded-3xl text-[10px] md:text-xs font-black transition-all border flex items-center gap-2 shrink-0",
        active
          ? "bg-primary text-white border-primary shadow-xl shadow-primary/20 scale-105"
          : "bg-white dark:bg-card/50 border-border/40 text-muted-foreground hover:bg-muted hover:border-border"
      )}
    >
       {color && <span className={cn("size-1.5 rounded-full", color)} />}
       <span>{label}</span>
       {count !== undefined && <span className={cn("min-w-[18px] h-4 px-1 rounded-md text-[8px] flex items-center justify-center", active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>{count}</span>}
    </button>
  );
}

function StatusStep({ active, disabled, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all",
        active
          ? "bg-white dark:bg-card text-primary shadow-sm"
          : "text-muted-foreground opacity-60 hover:opacity-100 disabled:cursor-not-allowed"
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
                     {members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
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
