import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  CalendarDays,
  MapPin,
  Clock,
  Users,
  X,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Plus,
  MapPinIcon,
  ChevronLeft,
  UserCheck,
  UserX,
  UserPlus,
  Share2,
  Calendar,
  ChevronDown,
  Timer,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/_authenticated/meetings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الاجتماعات — السيف" },
      { name: "description", content: "جدول اجتماعات العائلة، تأكيد الحضور، وتفاصيل اللقاء." },
    ],
  }),
  component: MeetingsPage,
});

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  return "عضو";
}

type Rsvp = "going" | "not_going" | "maybe";

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  location_url: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: "scheduled" | "cancelled" | "completed";
  created_by: string;
};

type Attendee = { meeting_id: string; user_id: string; rsvp: Rsvp };
type ProfileLite = { id: string; arabic_name: string | null; full_name: string | null; avatar_url: string | null };

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    day: d.getDate(),
    month: d.toLocaleString("ar-SA", { month: "long" }),
    weekday: d.toLocaleString("ar-SA", { weekday: "long" }),
    time: d.toLocaleString("ar-SA", { hour: "numeric", minute: "2-digit" }),
    full: d.toLocaleString("ar-SA", { dateStyle: "long" })
  };
}

function statusChip(status: Meeting["status"], scheduledAt: string) {
  if (status === "cancelled")
    return { label: "ملغي", className: "bg-red-500/10 text-red-600 border-red-500/20" };
  if (status === "completed" || new Date(scheduledAt) < new Date())
    return { label: "منتهي", className: "bg-slate-500/10 text-slate-600 border-slate-500/20" };
  return { label: "قادم", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
}

function MeetingsPage() {
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
  }>({ name: "عضو العائلة", role: "عضو", initial: "ص", avatarPath: null });
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const canManage = userRole === "admin" || userRole === "manager";

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // form fields
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fLocationUrl, setFLocationUrl] = useState("");
  const [fWhen, setFWhen] = useState("");
  const [fDuration, setFDuration] = useState("");

  const resetForm = useCallback(() => {
    setFTitle("");
    setFDesc("");
    setFLocation("");
    setFLocationUrl("");
    setFWhen("");
    setFDuration("");
    setEditing(null);
  }, []);

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(m: Meeting) {
    setEditing(m);
    setFTitle(m.title);
    setFDesc(m.description ?? "");
    setFLocation(m.location ?? "");
    setFLocationUrl(m.location_url ?? "");
    const d = new Date(m.scheduled_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    setFWhen(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
    setFDuration(m.duration_minutes ? String(m.duration_minutes) : "");
    setShowForm(true);
  }

  const loadAll = useCallback(async () => {
    const [{ data: m, error: me }, { data: a }, { data: pr }] = await Promise.all([
      supabase
        .from("meetings")
        .select(
          "id,title,description,location,location_url,scheduled_at,duration_minutes,status,created_by",
        )
        .order("scheduled_at", { ascending: true }),
      supabase.from("meeting_attendees").select("meeting_id,user_id,rsvp"),
      supabase.from("profiles").select("id, arabic_name, full_name, avatar_url"),
    ]);
    if (me) toast.error("تعذر تحميل الاجتماعات");
    setMeetings((m ?? []) as Meeting[]);
    setAttendees((a ?? []) as Attendee[]);
    const map: Record<string, ProfileLite> = {};
    (pr ?? []).forEach((p: any) => { map[p.id] = p; });
    setProfiles(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        setUserId(u.user.id);
        const [{ data: p }, { data: r }] = await Promise.all([
          supabase
            .from("profiles")
            .select("arabic_name, full_name, avatar_url")
            .eq("id", u.user.id)
            .maybeSingle(),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", u.user.id)
            .order("role")
            .limit(1)
            .maybeSingle(),
        ]);
        const name =
          p?.arabic_name?.trim() ||
          p?.full_name?.trim() ||
          u.user.email?.split("@")[0] ||
          "عضو العائلة";
        setProfile({
          name,
          role: roleLabel(r?.role ?? null),
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
        });
        setUserRole(r?.role ?? null);
      }
      await loadAll();
    })();

    const channel = supabase
      .channel("meetings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => loadAll())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_attendees" },
        () => loadAll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!canManage) return;
    if (window.location.hash === "#new") {
      openCreate();
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [canManage, resetForm]);


  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!fTitle.trim() || !fWhen) {
      toast.error("العنوان والموعد مطلوبان");
      return;
    }
    setSubmitting(true);
    const payload = {
      title: fTitle.trim(),
      description: fDesc.trim() || null,
      location: fLocation.trim() || null,
      location_url: fLocationUrl.trim() || null,
      scheduled_at: new Date(fWhen).toISOString(),
      duration_minutes: fDuration ? Number(fDuration) : null,
    };
    if (editing) {
      const { error } = await supabase.from("meetings").update(payload).eq("id", editing.id);
      if (error) toast.error("تعذر التحديث: " + error.message);
      else {
        toast.success("تم تحديث الاجتماع");
        setShowForm(false);
        resetForm();
        loadAll();
      }
    } else {
      const { error } = await supabase
        .from("meetings")
        .insert({ ...payload, created_by: userId });
      if (error) toast.error("تعذر الإنشاء: " + error.message);
      else {
        toast.success("تم إنشاء الاجتماع");
        setShowForm(false);
        resetForm();
        loadAll();
      }
    }
    setSubmitting(false);
  }

  async function deleteMeeting(id: string) {
    if (!confirm("هل تريد حذف هذا الاجتماع؟")) return;
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) toast.error("تعذر الحذف");
    else {
      toast.success("تم الحذف");
      loadAll();
    }
  }

  async function setRsvp(meetingId: string, rsvp: Rsvp) {
    if (!userId) return;

    const existing = attendees.find(a => a.meeting_id === meetingId && a.user_id === userId);

    // Optimistic Update
    if (existing && existing.rsvp === rsvp) {
      // Toggle off
      setAttendees(prev => prev.filter(a => !(a.meeting_id === meetingId && a.user_id === userId)));
      const { error } = await supabase.from("meeting_attendees").delete().eq("meeting_id", meetingId).eq("user_id", userId);
      if (error) { toast.error("فشل التحديث"); loadAll(); }
      else toast.success("تم إلغاء الاختيار");
    } else {
      // Update or Insert
      const newEntry = { meeting_id: meetingId, user_id: userId, rsvp };
      setAttendees(prev => {
        const filtered = prev.filter(a => !(a.meeting_id === meetingId && a.user_id === userId));
        return [...filtered, newEntry];
      });

      const { error } = await supabase.from("meeting_attendees").upsert(newEntry, { onConflict: "meeting_id,user_id" });
      if (error) { toast.error("فشل التحديث"); loadAll(); }
      else {
        if (rsvp === 'going') toast.success("تم تأكيد حضورك");
        else if (rsvp === 'not_going') toast.info("تم تسجيل اعتذارك");
        else toast.success("تم تحديث الحالة");
      }
    }

    // Sync with server after a short delay
    setTimeout(loadAll, 500);
  }

  function countsFor(meetingId: string) {
    const list = attendees.filter((a) => a.meeting_id === meetingId);
    return {
      going: list.filter((a) => a.rsvp === "going").length,
      not_going: list.filter((a) => a.rsvp === "not_going").length,
      maybe: list.filter((a) => a.rsvp === "maybe").length,
    };
  }

  function myRsvp(meetingId: string): Rsvp | null {
    if (!userId) return null;
    return attendees.find((a) => a.meeting_id === meetingId && a.user_id === userId)?.rsvp ?? null;
  }

  const upcoming = meetings.filter(
    (m) => m.status !== "cancelled" && new Date(m.scheduled_at) >= new Date(),
  );
  const past = meetings.filter(
    (m) => m.status === "cancelled" || new Date(m.scheduled_at) < new Date(),
  );

  return (
    <AppShell title="الاجتماعات" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24" dir="rtl">

        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-[48px] bg-[#1a2b3c] p-12 md:p-20 text-white shadow-2xl animate-fade-up">
           <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/40 to-transparent z-10" />
           <div className="absolute top-0 left-0 size-96 opacity-[0.08] -translate-x-1/4 -translate-y-1/4 pointer-events-none logo-royal"
                style={{ '--logo-url': `url(${alsaifMark.url})` } as any} />

           <div className="relative z-20 flex flex-col md:flex-row md:items-end justify-between gap-10">
              <div className="space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="h-1.5 w-16 bg-gold-primary rounded-full shadow-[0_0_20px_rgba(142,119,69,0.6)]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.6em] text-gold-primary">ديوانية آل سيف</span>
                 </div>
                 <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.9]">اللقاءات<br/>العائلية</h2>
                 <p className="text-xl text-white/70 font-bold max-w-md leading-relaxed">حيث يجتمع الإرث بالحاضر، لنرسم معاً ملامح المستقبل.</p>
              </div>

              {canManage && (
                <button
                  onClick={openCreate}
                  className="btn-gold px-12 py-6 rounded-[32px] text-xl font-black shadow-2xl shadow-gold-primary/30 flex items-center justify-center gap-4 group/btn hover:scale-105 active:scale-95 transition-all duration-500"
                >
                  <Plus className="size-7 group-hover/btn:rotate-180 transition-transform duration-700" strokeWidth={3} />
                  <span>جدولة لقاء</span>
                </button>
              )}
           </div>
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-6 opacity-40">
             <div className="size-20 rounded-full border-4 border-primary/10 border-t-gold-primary animate-spin" />
             <p className="font-black text-primary uppercase tracking-[0.3em] text-xs">جاري تجهيز المجلس...</p>
          </div>
        ) : (
          <div className="space-y-24 px-4 md:px-0">
            {/* Upcoming Section */}
            <section className="space-y-12">
              <div className="flex items-center gap-8">
                 <div className="flex items-center gap-3 text-primary">
                    <CalendarDays className="size-5" />
                    <h3 className="text-sm font-black uppercase tracking-[0.4em] whitespace-nowrap">الفعاليات القادمة</h3>
                 </div>
                 <div className="h-px flex-1 bg-gradient-to-l from-primary/20 to-transparent" />
                 <div className="hidden sm:flex items-center gap-2 bg-primary/5 px-5 py-2 rounded-full border border-primary/10 backdrop-blur-sm">
                    <span className="text-[10px] font-black text-primary opacity-60">إجمالي المجدول:</span>
                    <span className="text-xs font-black text-primary">{upcoming.length}</span>
                 </div>
              </div>

              {upcoming.length === 0 ? (
                <div className="card-surface p-24 flex flex-col items-center text-center gap-8 border-dashed border-4 opacity-40 rounded-[56px] bg-muted/20">
                   <div className="size-28 rounded-[48px] bg-white dark:bg-card flex items-center justify-center text-muted-foreground shadow-2xl border border-border/40">
                      <CalendarDays size={56} strokeWidth={1.5} className="opacity-20" />
                   </div>
                   <div className="space-y-3">
                      <p className="text-3xl font-black text-primary tracking-tight">المجلس بانتظاركم</p>
                      <p className="text-lg font-bold text-muted-foreground max-w-sm">لا توجد اجتماعات مجدولة حالياً. ترقبوا الإشعارات لأي جديد.</p>
                   </div>
                </div>
              ) : (
                <div className="grid gap-10">
                  {upcoming.map((m, i) => (
                    <MeetingCard
                      key={m.id}
                      index={i}
                      meeting={m}
                      counts={countsFor(m.id)}
                      attendeesList={attendees.filter((a) => a.meeting_id === m.id)}
                      profiles={profiles}
                      myRsvp={myRsvp(m.id)}
                      onRsvp={setRsvp}
                      canManage={canManage}
                      onEdit={openEdit}
                      onDelete={deleteMeeting}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Archive Section */}
            {past.length > 0 && (
              <section className="space-y-12">
                <div className="flex items-center gap-8 opacity-40">
                   <div className="flex items-center gap-3">
                      <Clock className="size-5" />
                      <h3 className="text-sm font-black uppercase tracking-[0.4em] whitespace-nowrap">سجل اللقاءات</h3>
                   </div>
                   <div className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
                </div>
                <div className="grid gap-6 opacity-60 grayscale-[0.5] hover:grayscale-0 hover:opacity-100 transition-all duration-1000">
                  {past.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      counts={countsFor(m.id)}
                      attendeesList={attendees.filter((a) => a.meeting_id === m.id)}
                      profiles={profiles}
                      myRsvp={myRsvp(m.id)}
                      onRsvp={setRsvp}
                      canManage={canManage}
                      onEdit={openEdit}
                      onDelete={deleteMeeting}
                      isPast
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Royal Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-card border border-border rounded-[48px] w-full max-w-2xl overflow-hidden shadow-2xl"
              dir="rtl"
            >
              <div className="p-8 sm:p-12 space-y-8">
                <div className="flex items-center justify-between">
                   <div className="space-y-1">
                      <h3 className="text-3xl font-black tracking-tight text-primary">
                        {editing ? "تعديل اللقاء" : "جدولة لقاء عائلي"}
                      </h3>
                      <p className="text-muted-foreground font-bold text-sm">أدخل تفاصيل الاجتماع ليتم إخطار بقية الأعضاء.</p>
                   </div>
                   <button onClick={() => setShowForm(false)} className="size-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-primary transition-all">
                      <X size={24} />
                   </button>
                </div>

                <form onSubmit={submitForm} className="space-y-6">
                  <div className="grid gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">عنوان الاجتماع</label>
                       <input
                        value={fTitle}
                        onChange={(e) => setFTitle(e.target.value)}
                        required
                        placeholder="مثال: اجتماع العائلة السنوي"
                        className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-lg focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">وصف موجز</label>
                       <textarea
                        value={fDesc}
                        onChange={(e) => setFDesc(e.target.value)}
                        rows={3}
                        placeholder="ماذا سنناقش في هذا اللقاء؟"
                        className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">موعد اللقاء</label>
                         <input
                          type="datetime-local"
                          value={fWhen}
                          onChange={(e) => setFWhen(e.target.value)}
                          required
                          className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">المدة التقريبية</label>
                         <div className="relative">
                            <input
                              type="number"
                              min="0"
                              value={fDuration}
                              onChange={(e) => setFDuration(e.target.value)}
                              placeholder="60"
                              className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                            />
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-xs uppercase">دقيقة</span>
                         </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">مكان الاجتماع / الرابط</label>
                       <div className="grid gap-3">
                          <input
                            value={fLocation}
                            onChange={(e) => setFLocation(e.target.value)}
                            placeholder="مثال: مجلس العائلة / الرياض"
                            className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                          />
                          <input
                            type="url"
                            value={fLocationUrl}
                            onChange={(e) => setFLocationUrl(e.target.value)}
                            placeholder="رابط الموقع على خرائط جوجل"
                            className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                          />
                       </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 btn-gold py-5 rounded-[28px] text-lg font-black shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="size-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        <span>{editing ? "حفظ التعديلات" : "تأكيد الجدولة"}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-10 py-5 rounded-[28px] bg-muted/50 font-black text-muted-foreground hover:bg-muted transition-all"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function MeetingCard({
  meeting,
  counts,
  attendeesList,
  profiles,
  myRsvp,
  onRsvp,
  canManage,
  onEdit,
  onDelete,
  isPast = false,
  index = 0
}: {
  meeting: Meeting;
  counts: { going: number; not_going: number; maybe: number };
  attendeesList: Attendee[];
  profiles: Record<string, ProfileLite>;
  myRsvp: Rsvp | null;
  onRsvp: (id: string, r: Rsvp) => void;
  canManage: boolean;
  onEdit: (m: Meeting) => void;
  onDelete: (id: string) => void;
  isPast?: boolean;
  index?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const date = formatDate(meeting.scheduled_at);
  const status = statusChip(meeting.status, meeting.scheduled_at);

  const going = attendeesList.filter(a => a.rsvp === "going").map(a => profiles[a.user_id]).filter(Boolean);
  const maybe = attendeesList.filter(a => a.rsvp === "maybe").map(a => profiles[a.user_id]).filter(Boolean);
  const notGoing = attendeesList.filter(a => a.rsvp === "not_going").map(a => profiles[a.user_id]).filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.8, ease: "easeOut" }}
      className="group"
    >
      <div className={cn(
        "card-surface overflow-hidden border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-500 rounded-[48px]",
        expanded ? "ring-2 ring-primary bg-primary/5" : "hover:-translate-y-2 hover:shadow-[0_40px_80px_rgba(0,0,0,0.15)]"
      )}>
        <div className="flex flex-col md:flex-row relative z-10 min-h-[320px]">

          {/* Date Column */}
          <div className="w-full md:w-64 p-6 md:p-10 flex flex-row md:flex-col items-center justify-between md:justify-center text-center bg-gradient-to-br from-primary/5 to-primary/[0.02] border-b md:border-b-0 md:border-l border-border/40 shrink-0 relative overflow-hidden group-hover:bg-primary/[0.08] transition-colors gap-4">
             <div className="absolute inset-0 opacity-[0.03] pointer-events-none logo-royal scale-[1.5]" style={{ '--logo-url': `url(${alsaifMark.url})` } as any} />
             <div className="flex flex-col md:items-center items-start relative z-10">
                <span className="text-gold-primary font-black uppercase tracking-[0.3em] text-[10px] mb-1 md:mb-3">{date.weekday}</span>
                <div className="flex items-baseline gap-2 md:block">
                   <span className="text-4xl md:text-7xl font-black tracking-tighter text-primary leading-none">{date.day}</span>
                   <span className="text-lg md:text-xl font-black text-primary opacity-50 mt-1 md:mt-2">{date.month}</span>
                </div>
             </div>
             <div className="flex items-center gap-2 md:gap-3 px-4 py-2 md:px-5 md:py-2.5 bg-white dark:bg-card border border-border/60 rounded-2xl shadow-xl relative z-10">
                <Timer className="size-3.5 md:size-4 text-gold-primary animate-pulse" />
                <span className="text-[12px] md:text-[14px] font-black text-primary">{date.time}</span>
             </div>
          </div>

          {/* Main Info Column */}
          <div className="flex-1 p-6 md:p-14 flex flex-col justify-between space-y-8 md:space-y-10 relative overflow-hidden">
             {/* Large background info icon */}
             <div className="absolute top-1/2 right-10 -translate-y-1/2 opacity-[0.02] pointer-events-none rotate-12">
                <Calendar size={300} strokeWidth={1} />
             </div>

             <div className="space-y-6 relative z-10">
                <div className="flex flex-wrap items-center gap-3">
                   <span className={cn("px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-sm", status.className)}>
                     {status.label}
                   </span>
                   {meeting.duration_minutes && (
                     <span className="px-3 py-1.5 bg-muted/50 rounded-xl text-[10px] font-black text-muted-foreground uppercase opacity-80 flex items-center gap-2 border border-border/40">
                       <Clock className="size-3" /> {meeting.duration_minutes} دقيقة
                     </span>
                   )}
                   <div className="flex-1" />
                   {canManage && !isPast && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => onEdit(meeting)} className="size-11 rounded-2xl bg-white dark:bg-card border border-border/60 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white hover:border-primary transition-all shadow-lg active:scale-95"><Pencil size={18} /></button>
                        <button onClick={() => onDelete(meeting.id)} className="size-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all shadow-lg active:scale-95"><Trash2 size={18} /></button>
                      </div>
                   )}
                </div>

                <div className="space-y-3">
                   <h4 className="text-4xl md:text-5xl font-black text-primary leading-tight tracking-tight group-hover:text-gold-primary transition-colors duration-500">{meeting.title}</h4>
                   {meeting.description && (
                     <p className="text-muted-foreground font-bold text-lg leading-relaxed max-w-2xl border-r-4 border-gold-primary/20 pr-6 py-2">{meeting.description}</p>
                   )}
                </div>
             </div>

             <div className="flex flex-wrap items-center gap-10 relative z-10">
                {meeting.location && (
                  <div className="flex items-center gap-5 group/loc">
                     <div className="size-14 rounded-3xl bg-gold-primary/10 flex items-center justify-center text-gold-primary shadow-inner border border-gold-primary/20 group-hover/loc:bg-gold-primary group-hover/loc:text-white transition-all duration-500">
                        <MapPinIcon size={24} />
                     </div>
                     <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">مكان اللقاء</p>
                        {meeting.location_url ? (
                          <a href={meeting.location_url} target="_blank" rel="noreferrer" className="text-base font-black hover:text-gold-primary underline underline-offset-8 decoration-gold-primary/30 hover:decoration-gold-primary transition-all flex items-center gap-2">
                             {meeting.location}
                             <Share2 size={14} className="opacity-40" />
                          </a>
                        ) : (
                          <p className="text-base font-black">{meeting.location}</p>
                        )}
                     </div>
                  </div>
                )}

                <div className="flex items-center gap-5">
                   <div className="size-14 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shadow-inner border border-primary/20">
                      <Users size={24} />
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="flex -space-x-4 space-x-reverse">
                        {going.slice(0, 4).map((a) => (
                           <div key={a.id} className="size-10 rounded-2xl border-4 border-background overflow-hidden shadow-xl ring-1 ring-border/40">
                              <UserAvatar path={a.avatar_url} name={a.arabic_name || a.full_name} className="size-full" userId={a.id} />
                           </div>
                        ))}
                        {going.length > 4 && (
                          <div className="size-10 rounded-2xl border-4 border-background bg-gold-primary text-black text-xs font-black flex items-center justify-center shadow-xl ring-1 ring-gold-primary/40">+{going.length - 4}</div>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">المؤكدون</p>
                        <button onClick={() => setExpanded(!expanded)} className="text-sm font-black text-primary hover:text-gold-primary transition-colors underline decoration-gold-primary/20 decoration-2 underline-offset-4 flex items-center gap-2">
                           {counts.going} حاضر
                           <ChevronDown size={14} className={cn("transition-transform duration-500", expanded ? "rotate-180" : "")} />
                        </button>
                      </div>
                   </div>
                </div>
             </div>

             {/* RSVP Actions - Modern Bar */}
             {!isPast && (
               <div className="pt-6 md:pt-8 border-t border-border/40 flex flex-col lg:flex-row items-center gap-6 relative z-10">
                 <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full lg:w-auto p-1.5 bg-muted/40 rounded-2xl md:rounded-[28px] border border-border/40 backdrop-blur-sm shadow-inner">
                    <RsvpButton
                      active={myRsvp === "going"}
                      onClick={() => onRsvp(meeting.id, "going")}
                      icon={<UserCheck className="size-4 md:size-[18px]" />}
                      label="سأحضر"
                      color="emerald"
                    />
                    <RsvpButton
                      active={myRsvp === "maybe"}
                      onClick={() => onRsvp(meeting.id, "maybe")}
                      icon={<HelpCircle className="size-4 md:size-[18px]" />}
                      label="ربما"
                      color="amber"
                    />
                    <RsvpButton
                      active={myRsvp === "not_going"}
                      onClick={() => onRsvp(meeting.id, "not_going")}
                      icon={<UserX className="size-4 md:size-[18px]" />}
                      label="أعتذر"
                      color="rose"
                    />
                 </div>

                 <div className="hidden lg:block h-10 w-px bg-border/40 mx-2" />

                 <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    <div className="flex items-center gap-2">
                       <div className="size-1.5 rounded-full bg-emerald-500" /> {counts.going} مؤكد
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="size-1.5 rounded-full bg-amber-500" /> {counts.maybe} ربما
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="size-1.5 rounded-full bg-rose-500" /> {counts.not_going} اعتذار
                    </div>
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* Expanded Attendee Lists */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="overflow-hidden border-t border-border/40 bg-primary/[0.02]"
            >
              <div className="p-10 md:p-14 grid grid-cols-1 md:grid-cols-3 gap-12">
                <AttendeeCategory title="سيحضرون اللقاء" count={counts.going} list={going} color="emerald" icon={<UserCheck className="size-5" />} />
                <AttendeeCategory title="احتمالية الحضور" count={counts.maybe} list={maybe} color="amber" icon={<HelpCircle className="size-5" />} />
                <AttendeeCategory title="اعتذروا عن الحضور" count={counts.not_going} list={notGoing} color="rose" icon={<UserX className="size-5" />} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function AttendeeCategory({ title, count, list, color, icon }: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b-2 border-border/40 pb-4">
         <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-xl",
              color === "emerald" ? "bg-emerald-500/10 text-emerald-500" :
              color === "amber" ? "bg-amber-500/10 text-amber-500" :
              "bg-rose-500/10 text-rose-500")}>
               {icon}
            </div>
            <h5 className="font-black text-base tracking-tight text-primary">{title}</h5>
         </div>
         <span className="px-3 py-1 bg-muted rounded-full text-[10px] font-black opacity-60">{count}</span>
      </div>
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-3 opacity-20 border-2 border-dashed border-border rounded-3xl">
           <AlertCircle size={32} />
           <p className="text-xs font-bold italic">لا توجد أسماء</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {list.map((p: any) => (
            <li key={p.id} className="flex items-center gap-4 group/user p-2 rounded-2xl hover:bg-white dark:hover:bg-card transition-all duration-300">
               <div className="size-10 rounded-xl border border-border overflow-hidden bg-muted flex-shrink-0 shadow-sm transition-transform group-hover/user:scale-105">
                  <UserAvatar path={p.avatar_url} name={p.arabic_name || p.full_name} className="size-full" userId={p.id} />
               </div>
               <span className="text-sm font-black text-primary opacity-80 group-hover/user:opacity-100 transition-opacity truncate">{p.arabic_name || p.full_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RsvpButton({ active, onClick, icon, label, color }: any) {
  const colors: any = {
    emerald: active ? "bg-emerald-600 text-white shadow-xl shadow-emerald-500/30 scale-105" : "bg-transparent text-emerald-600 border-transparent hover:bg-emerald-500/10",
    amber: active ? "bg-amber-500 text-white shadow-xl shadow-amber-500/30 scale-105" : "bg-transparent text-amber-600 border-transparent hover:bg-amber-500/10",
    rose: active ? "bg-rose-600 text-white shadow-xl shadow-rose-500/30 scale-105" : "bg-transparent text-rose-600 border-transparent hover:bg-rose-500/10",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "flex-1 min-w-[110px] inline-flex items-center justify-center gap-2 px-6 py-4 rounded-[22px] text-xs font-black transition-all duration-500 border-2",
        active ? "border-transparent" : "border-transparent",
        colors[color]
      )}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}
