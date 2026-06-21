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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

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
  low: "text-sky-300 bg-sky-500/10 ring-1 ring-sky-500/20",
  medium: "text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/20",
  high: "text-red-300 bg-red-500/10 ring-1 ring-red-500/20",
};

const statusStyles: Record<TaskStatus, string> = {
  todo: "text-ivory/70 bg-secondary/40 ring-1 ring-border",
  in_progress: "text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/20",
  done: "text-emerald-300 bg-emerald-500/10 ring-1 ring-emerald-500/20",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function TasksPage() {
  const [profile, setProfile] = useState({
    name: "عضو العائلة",
    role: "عضو",
    initial: "ص",
    avatarPath: null as string | null,
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [isPrivileged, setIsPrivileged] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<"all" | "mine" | TaskStatus>("all");
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const memberMap = useMemo(() => {
    const m = new Map<string, Member>();
    members.forEach((mb) => m.set(mb.id, mb));
    return m;
  }, [members]);

  // Load profile + role
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("arabic_name, full_name, avatar_url")
          .eq("id", u.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const r = (roles ?? []).map((x) => x.role);
      setIsPrivileged(r.includes("admin") || r.includes("manager"));
      const primaryRole = r.includes("admin") ? "admin" : r.includes("manager") ? "manager" : "member";
      const name =
        p?.arabic_name?.trim() || p?.full_name?.trim() || u.user.email?.split("@")[0] || "عضو العائلة";
      setProfile({
        name,
        role: roleLabel(primaryRole),
        initial: (name[0] ?? "س").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
      });
    })();
  }, []);

  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, arabic_name, full_name, avatar_url")
      .order("arabic_name", { ascending: true });
    setMembers(
      (data ?? []).map((p) => ({
        id: p.id,
        name: p.arabic_name?.trim() || p.full_name?.trim() || "عضو",
        avatar_url: p.avatar_url ?? null,
      })),
    );
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("تعذر تحميل المهام");
      setLoading(false);
      return;
    }
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMembers();
    loadTasks();
    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        loadTasks();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMembers, loadTasks]);

  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks;
    if (filter === "mine") return tasks.filter((t) => t.assignee_id === userId);
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter, userId]);

  const counts = useMemo(
    () => ({
      total: tasks.length,
      todo: tasks.filter((t) => t.status === "todo").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
      mine: tasks.filter((t) => t.assignee_id === userId && t.status !== "done").length,
    }),
    [tasks, userId],
  );

  async function quickToggleStatus(task: Task) {
    const next: TaskStatus =
      task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
    const payload: Partial<Task> = { status: next };
    if (next === "done") payload.completed_at = new Date().toISOString();
    else payload.completed_at = null;
    const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
    if (error) {
      toast.error("تعذر تحديث المهمة");
      return;
    }
    toast.success("تم تحديث الحالة");
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("tasks").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) {
      toast.error("تعذر حذف المهمة");
      return;
    }
    toast.success("تم حذف المهمة");
  }

  function canEdit(task: Task) {
    return isPrivileged || task.created_by === userId || task.assignee_id === userId;
  }

  function canDelete(task: Task) {
    return isPrivileged || task.created_by === userId;
  }

  return (
    <AppShell title="المهام" user={profile}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 bg-gold-primary/10 ring-1 ring-gold-primary/30 rounded-lg grid place-items-center">
                <ListChecks className="size-5 text-gold-primary" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-medium text-ivory">المهام والمسؤوليات</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              تنظيم وتتبع المهام بين أعضاء العائلة.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingTask(null);
              setOpenDialog(true);
            }}
            className="bg-gold-primary text-navy-base hover:bg-gold-primary/90"
          >
            <Plus className="size-4 ml-2" strokeWidth={2} />
            مهمة جديدة
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="الإجمالي" value={counts.total} />
          <StatCard label="قيد الانتظار" value={counts.todo} accent="text-ivory/70" />
          <StatCard label="قيد التنفيذ" value={counts.inProgress} accent="text-amber-300" />
          <StatCard label="مهامي النشطة" value={counts.mine} accent="text-gold-primary" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="size-4 text-muted-foreground" strokeWidth={1.5} />
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="bg-card/40">
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="mine">مهامي</TabsTrigger>
              <TabsTrigger value="todo">قيد الانتظار</TabsTrigger>
              <TabsTrigger value="in_progress">قيد التنفيذ</TabsTrigger>
              <TabsTrigger value="done">مكتملة</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="size-6 animate-spin text-gold-primary mx-auto" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl">
            <ListChecks className="size-10 text-muted-foreground mx-auto mb-3" strokeWidth={1.2} />
            <p className="text-sm text-muted-foreground">لا توجد مهام في هذا القسم.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const assignee = task.assignee_id ? memberMap.get(task.assignee_id) : null;
              return (
                <div
                  key={task.id}
                  className="group bg-card/50 border border-border rounded-xl p-4 hover:border-gold-primary/30 transition"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => canEdit(task) && quickToggleStatus(task)}
                      disabled={!canEdit(task)}
                      className="mt-0.5 shrink-0 disabled:cursor-not-allowed"
                      aria-label="تغيير الحالة"
                    >
                      {task.status === "done" ? (
                        <CheckCircle2 className="size-5 text-emerald-400" strokeWidth={1.5} />
                      ) : task.status === "in_progress" ? (
                        <Loader2 className="size-5 text-amber-300" strokeWidth={1.5} />
                      ) : (
                        <Circle
                          className="size-5 text-muted-foreground group-hover:text-gold-primary transition"
                          strokeWidth={1.5}
                        />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <h3
                          className={`text-sm font-medium ${
                            task.status === "done" ? "text-muted-foreground line-through" : "text-ivory"
                          }`}
                        >
                          {task.title}
                        </h3>
                        <div className="flex items-center gap-1 shrink-0">
                          {canEdit(task) && (
                            <button
                              onClick={() => {
                                setEditingTask(task);
                                setOpenDialog(true);
                              }}
                              className="p-1.5 text-muted-foreground hover:text-gold-primary transition rounded-md"
                              aria-label="تعديل"
                            >
                              <Pencil className="size-3.5" strokeWidth={1.5} />
                            </button>
                          )}
                          {canDelete(task) && (
                            <button
                              onClick={() => setDeleteId(task.id)}
                              className="p-1.5 text-muted-foreground hover:text-red-400 transition rounded-md"
                              aria-label="حذف"
                            >
                              <Trash2 className="size-3.5" strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                          {task.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusStyles[task.status]}`}>
                          {statusLabels[task.status]}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${priorityStyles[task.priority]}`}
                        >
                          <Flag className="size-2.5" strokeWidth={2} />
                          {priorityLabels[task.priority]}
                        </span>
                        {task.due_date && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/40 ring-1 ring-border text-ivory/70 inline-flex items-center gap-1">
                            <CalendarIcon className="size-2.5" strokeWidth={2} />
                            {formatDate(task.due_date)}
                          </span>
                        )}
                        {assignee && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/40 ring-1 ring-border text-ivory/70 inline-flex items-center gap-1.5">
                            <span className="size-4 rounded-full overflow-hidden bg-gold-primary/20 grid place-items-center text-[8px] text-gold-primary">
                              <UserAvatar
                                path={assignee.avatar_url}
                                name={assignee.name}
                                className="size-full rounded-full"
                                fallbackClassName="grid place-items-center size-full"
                                userId={assignee.id}
                              />
                            </span>
                            {assignee.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TaskDialog
        open={openDialog}
        onOpenChange={(o) => {
          setOpenDialog(o);
          if (!o) setEditingTask(null);
        }}
        task={editingTask}
        members={members}
        userId={userId}
        onSaved={loadTasks}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المهمة؟</AlertDialogTitle>
            <AlertDialogDescription>
              لا يمكن التراجع عن هذا الإجراء. سيتم حذف المهمة نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  accent = "text-ivory",
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="bg-card/40 border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  task,
  members,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  members: Member[];
  userId: string | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus(task?.status ?? "todo");
      setPriority(task?.priority ?? "medium");
      setDueDate(task?.due_date ? task.due_date.slice(0, 10) : "");
      setAssigneeId(task?.assignee_id ?? "none");
    }
  }, [open, task]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("العنوان مطلوب");
      return;
    }
    if (!userId) return;
    setSaving(true);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      assignee_id: assigneeId === "none" ? null : assigneeId,
      completed_at:
        status === "done"
          ? task?.completed_at ?? new Date().toISOString()
          : null,
    };

    if (task) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
      setSaving(false);
      if (error) {
        toast.error("تعذر حفظ التعديلات");
        return;
      }
      toast.success("تم حفظ المهمة");
    } else {
      const { error } = await supabase
        .from("tasks")
        .insert({ ...payload, created_by: userId });
      setSaving(false);
      if (error) {
        toast.error("تعذر إنشاء المهمة");
        return;
      }
      toast.success("تم إنشاء المهمة");
    }

    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "تعديل المهمة" : "مهمة جديدة"}</DialogTitle>
          <DialogDescription>
            {task ? "حدّث تفاصيل المهمة." : "أضف مهمة جديدة وعيّن المسؤول عنها."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">العنوان *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: تنظيم اجتماع نهاية الشهر"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">الوصف</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="تفاصيل إضافية..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">قيد الانتظار</SelectItem>
                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                  <SelectItem value="done">مكتملة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>الأولوية</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="due_date">تاريخ الاستحقاق</Label>
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>المسند إليه</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر عضو" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— غير معيّن —</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-gold-primary text-navy-base hover:bg-gold-primary/90 w-full sm:w-auto font-bold"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : task ? "حفظ التعديلات" : "إنشاء المهمة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
