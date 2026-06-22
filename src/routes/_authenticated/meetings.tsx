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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";

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
    const existing = attendees.find((a) => a.meeting_id === meetingId && a.user_id === userId);
    if (existing) {
      const { error } = await supabase
        .from("meeting_attendees")
        .update({ rsvp })
        .eq("meeting_id", meetingId)
        .eq("user_id", userId);
      if (error) toast.error("تعذر التحديث");
      else loadAll();
      return;
    }
    const { error } = await supabase
      .from("meeting_attendees")
      .upsert(
        { meeting_id: meetingId, user_id: userId, rsvp },
        { onConflict: "meeting_id,user_id" },
      );
    if (error) toast.error("تعذر التحديث");
    else loadAll();
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
      <div className="max-w-5xl mx-auto space-y-12 pb-24" dir="rtl">

        {/* Modern Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-up">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="size-1 w-10 bg-gold-primary rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">جدول العائلة</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-primary">الاجتماعات القادمة</h2>
            <p className="text-muted-foreground font-bold text-lg opacity-70">تواصل، ترابط، واحفظ إرث عائلة آل سيف.</p>
          </div>
          {canManage && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openCreate}
              className="btn-gold px-8 py-4 flex items-center gap-3 shadow-2xl shadow-gold-primary/20 text-base"
            >
              <Plus className="size-5" strokeWidth={3} />
              <span>إضافة اجتماع جديد</span>
            </motion.button>
          )}
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
             <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
             <p className="font-black">جاري تحضير قائمة الاجتماعات...</p>
          </div>
        ) : (
          <div className="space-y-20">
            {/* Upcoming Section */}
            <section className="space-y-8 animate-fade-up" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center gap-4">
                 <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">المناسبات القريبة</h3>
                 <div className="h-px flex-1 bg-border/60" />
              </div>

              {upcoming.length === 0 ? (
                <div className="card-surface p-20 flex flex-col items-center text-center gap-6 border-dashed opacity-60">
                   <div className="size-20 rounded-[40px] bg-muted/50 flex items-center justify-center text-muted-foreground"><CalendarDays size={40} /></div>
                   <div className="space-y-1">
                      <p className="text-xl font-black">لا توجد اجتماعات قادمة</p>
                      <p className="text-sm font-bold opacity-60">سيتم إشعارك فور جدولة أي لقاء جديد.</p>
                   </div>
                </div>
              ) : (
                <div className="grid gap-6">
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

            {/* Past Section */}
            {past.length > 0 && (
              <section className="space-y-8 animate-fade-up" style={{ animationDelay: "200ms" }}>
                <div className="flex items-center gap-4">
                   <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">اللقاءات السابقة</h3>
                   <div className="h-px flex-1 bg-border/30" />
                </div>
                <div className="grid gap-4 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
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

  const getAttendeesByRsvp = (rsvp: Rsvp) => {
    return attendeesList
      .filter(a => a.rsvp === rsvp)
      .map(a => profiles[a.user_id])
      .filter(Boolean);
  };

  const going = getAttendeesByRsvp("going");
  const maybe = getAttendeesByRsvp("maybe");
  const notGoing = getAttendeesByRsvp("not_going");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative"
    >
      <div className={cn(
        "card-surface overflow-hidden border-none shadow-2xl transition-all duration-500",
        expanded ? "ring-2 ring-primary" : "hover:-translate-y-1"
      )}>
        {/* Decorative Background Mark */}
        <div className="absolute top-0 left-0 opacity-[0.03] -translate-x-1/4 -translate-y-1/4 pointer-events-none grayscale brightness-0 scale-150 group-hover:opacity-[0.05] transition-opacity duration-700">
           <img src={alsaifMark.url} className="size-64" alt="" />
        </div>

        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-border/40 relative z-10">

          {/* Left Side - Date Box */}
          <div className="w-full md:w-56 p-6 md:p-8 flex flex-row md:flex-col items-center justify-between md:justify-center text-center bg-primary/5 group-hover:bg-primary/10 transition-colors shrink-0 gap-4 md:gap-2">
             <div className="flex flex-col md:items-center items-start">
               <span className="text-gold-primary font-black uppercase tracking-[0.2em] text-[10px] mb-1">{date.weekday}</span>
               <div className="flex items-baseline gap-2 md:block">
                 <span className="text-4xl md:text-6xl font-black tracking-tighter text-primary">{date.day}</span>
                 <span className="text-base md:text-lg font-black text-primary opacity-60 mt-1">{date.month}</span>
               </div>
             </div>
             <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-card border border-border/60 rounded-full shadow-sm">
                <Clock className="size-3.5 md:size-3 text-gold-primary" />
                <span className="text-[12px] md:text-[12px] font-black text-primary">{date.time}</span>
             </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-6 md:p-10 space-y-6 md:space-y-8">
             <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2">
                   <div className="flex items-center gap-3">
                      <span className={cn("px-3 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider", status.className)}>
                        {status.label}
                      </span>
                      {meeting.duration_minutes && (
                        <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60 flex items-center gap-1">
                          <Clock className="size-3" /> {meeting.duration_minutes} دقيقة
                        </span>
                      )}
                   </div>
                   <h4 className="text-2xl md:text-3xl font-black text-primary leading-tight group-hover:text-gold-primary transition-colors">{meeting.title}</h4>
                   {meeting.description && (
                     <p className="text-muted-foreground font-bold text-sm leading-relaxed max-w-2xl">{meeting.description}</p>
                   )}
                </div>

                {canManage && !isPast && (
                  <div className="flex items-center gap-2 self-start">
                    <button onClick={() => onEdit(meeting)} className="size-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all shadow-sm"><Pencil size={16} /></button>
                    <button onClick={() => onDelete(meeting.id)} className="size-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"><Trash2 size={16} /></button>
                  </div>
                )}
             </div>

             <div className="flex flex-wrap items-center gap-8">
                {meeting.location && (
                  <div className="flex items-center gap-3">
                     <div className="size-10 rounded-xl bg-gold-primary/10 flex items-center justify-center text-gold-primary shadow-inner"><MapPinIcon size={20} /></div>
                     <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">الموقع</p>
                        {meeting.location_url ? (
                          <a href={meeting.location_url} target="_blank" rel="noreferrer" className="text-sm font-black hover:text-gold-primary underline underline-offset-4 decoration-gold-primary/30 decoration-2 transition-all">{meeting.location}</a>
                        ) : (
                          <p className="text-sm font-black">{meeting.location}</p>
                        )}
                     </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                   <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Users size={20} /></div>
                   <div className="flex items-center gap-2">
                      <div className="flex -space-x-3 space-x-reverse">
                        {going.slice(0, 3).map((a) => (
                           <div key={a.id} className="size-8 rounded-full border-2 border-background bg-muted overflow-hidden">
                              {a.avatar_url ? <img src={a.avatar_url} className="size-full object-cover" alt="" /> : <div className="size-full flex items-center justify-center bg-primary/10 text-primary text-[10px] font-black">{(a.arabic_name || a.full_name || "?")[0]}</div>}
                           </div>
                        ))}
                        {going.length > 3 && (
                          <div className="size-8 rounded-full border-2 border-background bg-gold-primary text-white text-[10px] font-black flex items-center justify-center">+{going.length - 3}</div>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">حالة الحضور</p>
                        <p className="text-xs font-black text-primary">{counts.going} حاضر · {counts.maybe} ربما · {counts.not_going} اعتذار</p>
                      </div>
                   </div>
                </div>
             </div>

             {/* RSVP Actions Section */}
             {!isPast && (
               <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
                 <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
                    <RsvpButton
                      active={myRsvp === "going"}
                      onClick={() => onRsvp(meeting.id, "going")}
                      icon={<UserCheck className="size-4" />}
                      label="سأحضر"
                      color="emerald"
                    />
                    <RsvpButton
                      active={myRsvp === "maybe"}
                      onClick={() => onRsvp(meeting.id, "maybe")}
                      icon={<HelpCircle className="size-4" />}
                      label="ربما"
                      color="amber"
                    />
                    <RsvpButton
                      active={myRsvp === "not_going"}
                      onClick={() => onRsvp(meeting.id, "not_going")}
                      icon={<UserX className="size-4" />}
                      label="أعتذر"
                      color="rose"
                    />
                 </div>

                 <div className="h-px flex-1 bg-border/40 hidden sm:block" />

                 <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest hover:text-gold-primary transition-colors px-4 py-2 rounded-full hover:bg-muted"
                 >
                    <span>{expanded ? "إخفاء التفاصيل" : "عرض قائمة الحضور"}</span>
                    <ChevronLeft className={cn("size-4 transition-transform duration-500", expanded ? "-rotate-90" : "")} />
                 </button>
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
              className="overflow-hidden border-t border-border/40 bg-muted/10"
            >
              <div className="p-8 grid grid-cols-1 sm:grid-cols-3 gap-10">
                <AttendeeCategory title="حاضرون" count={counts.going} list={going} color="emerald" />
                <AttendeeCategory title="ربما" count={counts.maybe} list={maybe} color="amber" />
                <AttendeeCategory title="أعتذروا" count={counts.not_going} list={notGoing} color="rose" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function AttendeeCategory({ title, count, list, color }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
         <div className="flex items-center gap-3">
            <div className={cn("size-2 rounded-full animate-pulse",
              color === "emerald" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
              color === "amber" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
              "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]")} />
            <h5 className="font-black text-sm uppercase tracking-widest text-primary">{title}</h5>
         </div>
         <span className="text-[10px] font-black opacity-40">{count} عضو</span>
      </div>
      {list.length === 0 ? (
        <p className="text-[11px] font-bold text-muted-foreground/60 italic">لا يوجد أحد حالياً</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {list.map((p: any) => (
            <li key={p.id} className="flex items-center gap-3 group/user">
               <div className="size-8 rounded-full border border-border overflow-hidden bg-muted flex-shrink-0">
                  {p.avatar_url ? <img src={p.avatar_url} className="size-full object-cover" alt="" /> : <div className="size-full flex items-center justify-center bg-primary/5 text-primary text-[10px] font-black">{(p.arabic_name || p.full_name || "?")[0]}</div>}
               </div>
               <span className="text-sm font-bold text-primary opacity-80 group-hover/user:opacity-100 transition-opacity truncate">{p.arabic_name || p.full_name || "عضو"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RsvpButton({ active, onClick, icon, label, color }: any) {
  const colors: any = {
    emerald: active ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 ring-emerald-500/20" : "bg-white dark:bg-card text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/5",
    amber: active ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30 ring-amber-500/20" : "bg-white dark:bg-card text-amber-600 border-amber-500/20 hover:bg-amber-500/5",
    rose: active ? "bg-rose-600 text-white shadow-lg shadow-rose-500/30 ring-rose-500/20" : "bg-white dark:bg-card text-rose-600 border-rose-500/20 hover:bg-rose-500/5",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "flex-1 min-w-[100px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs font-black border transition-all duration-300",
        colors[color]
      )}
    >
      {icon}
      <span>{label}</span>
      {active && <CheckCircle2 size={12} className="mr-auto" />}
    </motion.button>
  );
}
