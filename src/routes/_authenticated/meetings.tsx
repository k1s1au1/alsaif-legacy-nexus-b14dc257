import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, useCallback, useRef } from "react";
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
  Plus,
  ChevronLeft,
  UserCheck,
  UserX,
  HelpCircle,
  Timer,
  ChevronDown,
  Navigation,
  Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { UserAvatar } from "@/components/user-avatar";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export const Route = createFileRoute("/_authenticated/meetings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "المناسبات الملكية — السيف" },
      { name: "description", content: "جدول اجتماعات وفعاليات عائلة آل سيف." },
    ],
  }),
  component: MeetingsPage,
});

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
    year: d.getFullYear()
  };
}

function statusChip(status: string) {
   if (status === "cancelled") return { label: "ملغي", className: "bg-rose-500 text-white" };
   return { label: "قادم", className: "bg-emerald-500 text-white" };
}

function MeetingsPage() {
  const [profile, setProfile] = useState({ name: "عضو العائلة", role: "عضو", initial: "ص", avatarPath: null as string | null });
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
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

  const canManage = userRole === "admin" || userRole === "manager";
  const plugin = useRef(Autoplay({ delay: 5000, stopOnInteraction: true }));

  const resetForm = useCallback(() => {
    setFTitle("");
    setFDesc("");
    setFLocation("");
    setFLocationUrl("");
    setFWhen("");
    setFDuration("");
    setEditing(null);
  }, []);

  const loadAll = useCallback(async () => {
    const [{ data: m }, { data: a }, { data: pr }] = await Promise.all([
      supabase.from("meetings").select("*").order("scheduled_at", { ascending: true }),
      supabase.from("meeting_attendees").select("*"),
      supabase.from("profiles").select("id, arabic_name, full_name, avatar_url"),
    ]);
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
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).maybeSingle();
        const { data: p } = await supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", u.user.id).maybeSingle();
        setProfile({
          name: p?.arabic_name || p?.full_name || "عضو العائلة",
          role: r?.role || "member",
          initial: "ع",
          avatarPath: p?.avatar_url || null
        });
        setUserRole(r?.role || null);
      }
      await loadAll();
    })();
  }, [loadAll]);

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (m: Meeting) => {
    setEditing(m);
    setFTitle(m.title);
    setFDesc(m.description ?? "");
    setFLocation(m.location ?? "");
    setFLocationUrl(m.location_url ?? "");
    const d = new Date(m.scheduled_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    setFWhen(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setFDuration(m.duration_minutes ? String(m.duration_minutes) : "");
    setShowForm(true);
  };

  const submitForm = async (e: FormEvent) => {
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
      if (error) toast.error("تعذر التحديث");
      else {
        toast.success("تم التحديث");
        setShowForm(false);
        resetForm();
        loadAll();
      }
    } else {
      const { error } = await supabase.from("meetings").insert({ ...payload, created_by: userId });
      if (error) toast.error("تعذر الإنشاء");
      else {
        toast.success("تم الإنشاء");
        setShowForm(false);
        resetForm();
        loadAll();
      }
    }
    setSubmitting(false);
  };

  const deleteMeeting = async (id: string) => {
    if (!confirm("هل تريد حذف هذا الاجتماع؟")) return;
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) toast.error("تعذر الحذف");
    else {
      toast.success("تم الحذف");
      loadAll();
    }
  };

  const setRsvp = async (meetingId: string, rsvp: Rsvp) => {
    if (!userId) return;
    const current = attendees.find(a => a.meeting_id === meetingId && a.user_id === userId);

    if (current?.rsvp === rsvp) {
      setAttendees(prev => prev.filter(a => !(a.meeting_id === meetingId && a.user_id === userId)));
      await supabase.from("meeting_attendees").delete().eq("meeting_id", meetingId).eq("user_id", userId);
      toast.success("تم الإلغاء");
    } else {
      const newEntry = { meeting_id: meetingId, user_id: userId, rsvp };
      setAttendees(prev => [...prev.filter(a => !(a.meeting_id === meetingId && a.user_id === userId)), newEntry]);
      await supabase.from("meeting_attendees").upsert(newEntry);
      toast.success(rsvp === 'going' ? "ننتظر تشريفك!" : "تم التحديث");
    }
    loadAll();
  };

  const upcoming = meetings.filter(m => new Date(m.scheduled_at) >= new Date());
  const past = meetings.filter(m => new Date(m.scheduled_at) < new Date());

  const countsFor = (meetingId: string) => {
    const list = attendees.filter((a) => a.meeting_id === meetingId);
    return {
      going: list.filter((a) => a.rsvp === "going").length,
      not_going: list.filter((a) => a.rsvp === "not_going").length,
      maybe: list.filter((a) => a.rsvp === "maybe").length,
    };
  };

  const myRsvp = (meetingId: string): Rsvp | null => {
    if (!userId) return null;
    return attendees.find((a) => a.meeting_id === meetingId && a.user_id === userId)?.rsvp ?? null;
  };

  return (
    <AppShell title="الاجتماعات" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24 px-4 md:px-0" dir="rtl">

        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="size-1.5 w-12 bg-gold-primary rounded-full shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">ملتقى العائلة</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight text-primary">المناسبات والاجتماعات</h2>
            <p className="text-muted-foreground font-bold text-lg opacity-70">جدول اللقاءات العائلية القادمة لتعزيز الترابط والتواصل.</p>
          </div>
          {canManage && (
            <button
              onClick={openCreate}
              className="btn-gold px-8 py-4 rounded-2xl flex items-center gap-3 shadow-2xl shadow-gold-primary/20 text-base group w-full md:w-auto"
            >
              <Plus className="size-5 group-hover:rotate-90 transition-transform duration-500" strokeWidth={3} />
              <span>إضافة مناسبة جديدة</span>
            </button>
          )}
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
             <div className="size-16 rounded-full border-4 border-primary/20 border-t-gold-primary animate-spin" />
             <p className="font-black text-primary uppercase tracking-widest text-xs">جاري تجهيز المجلس...</p>
          </div>
        ) : (
          <div className="space-y-20">
            <section className="space-y-8 animate-fade-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-primary font-black uppercase tracking-widest text-xs">
                   <Timer className="size-4 text-gold-primary" /> أهم المناسبات القادمة
                </div>
              </div>

              {upcoming.length === 0 ? (
                <div className="card-surface p-24 flex flex-col items-center text-center gap-8 border-dashed border-4 opacity-40 rounded-[56px] bg-muted/20">
                   <CalendarDays size={64} className="text-muted-foreground opacity-20" />
                   <p className="text-2xl font-black text-primary">لا توجد اجتماعات مجدولة حالياً</p>
                </div>
              ) : (
                <Carousel
                  plugins={[plugin.current]}
                  className="w-full"
                  onMouseEnter={plugin.current.stop}
                  onMouseLeave={plugin.current.reset}
                  opts={{ direction: 'rtl', loop: true }}
                >
                  <CarouselContent>
                    {upcoming.map((m, i) => (
                      <CarouselItem key={m.id}>
                        <MeetingInteractiveCard
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
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <div className="hidden md:block">
                    <CarouselPrevious className="right-4 bg-white/20 border-white/40 text-white hover:bg-gold-primary hover:text-black" />
                    <CarouselNext className="left-4 bg-white/20 border-white/40 text-white hover:bg-gold-primary hover:text-black" />
                  </div>
                </Carousel>
              )}
            </section>

            {past.length > 0 && (
              <section className="space-y-8 animate-fade-up">
                <div className="flex items-center gap-4 opacity-50">
                   <Clock className="size-4" />
                   <h3 className="text-xs font-black uppercase tracking-[0.4em] whitespace-nowrap text-primary">الأرشيف والسجل</h3>
                   <div className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {past.map((m) => (
                    <div key={m.id} className="card-surface p-6 flex items-center justify-between opacity-60 hover:opacity-100 transition-all hover:bg-muted group rounded-[32px]">
                       <div className="flex items-center gap-6">
                          <div className="size-14 rounded-2xl bg-muted flex flex-col items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                             <span className="text-[10px] font-black uppercase tracking-tighter">{formatDate(m.scheduled_at).month}</span>
                             <span className="text-2xl font-black tracking-tighter leading-none">{formatDate(m.scheduled_at).day}</span>
                          </div>
                          <div>
                             <h4 className="font-black text-lg text-primary">{m.title}</h4>
                             <p className="text-xs font-bold text-muted-foreground">{formatDate(m.scheduled_at).year}</p>
                          </div>
                       </div>
                       <ChevronLeft className="opacity-20 group-hover:opacity-100 group-hover:-translate-x-2 transition-all" />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-card border border-border rounded-[48px] w-full max-w-2xl overflow-hidden shadow-2xl p-8 md:p-12 space-y-8"
              dir="rtl"
            >
              <div className="flex items-center justify-between">
                 <div className="space-y-1">
                    <h3 className="text-3xl font-black tracking-tight text-primary">{editing ? "تعديل اللقاء" : "جدولة لقاء عائلي"}</h3>
                 </div>
                 <button onClick={() => setShowForm(false)} className="size-12 rounded-full bg-muted/50 flex items-center justify-center hover:bg-primary hover:text-white transition-all"><X size={24} /></button>
              </div>

              <form onSubmit={submitForm} className="space-y-6">
                  <div className="grid gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">عنوان الاجتماع</label>
                       <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} required placeholder="مثال: اجتماع العائلة السنوي" className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-lg focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">وصف موجز</label>
                       <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={3} placeholder="ماذا سنناقش في هذا اللقاء؟" className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm resize-none" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">موعد اللقاء</label>
                         <input type="datetime-local" value={fWhen} onChange={(e) => setFWhen(e.target.value)} required className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">المدة التقريبية (دقيقة)</label>
                         <input type="number" min="0" value={fDuration} onChange={(e) => setFDuration(e.target.value)} placeholder="60" className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm" />
                      </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">مكان الاجتماع / الرابط</label>
                       <input value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="مثال: مجلس العائلة" className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm mb-3" />
                       <input type="url" value={fLocationUrl} onChange={(e) => setFLocationUrl(e.target.value)} placeholder="رابط الموقع على الخريطة" className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm" />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button type="submit" disabled={submitting} className="flex-1 btn-gold py-5 rounded-[28px] text-lg font-black shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3 disabled:opacity-50">
                      {submitting ? <div className="size-5 rounded-full border-2 border-white/20 border-t-white animate-spin" /> : <span>{editing ? "حفظ التعديلات" : "تأكيد الجدولة"}</span>}
                    </button>
                    <button type="button" onClick={() => setShowForm(false)} className="px-10 py-5 rounded-[28px] bg-muted/50 font-black text-muted-foreground hover:bg-muted transition-all">إلغاء</button>
                  </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function MeetingInteractiveCard({ meeting, counts, attendeesList, profiles, myRsvp, onRsvp, canManage, onEdit, onDelete }: any) {
  const date = formatDate(meeting.scheduled_at);
  const going = attendeesList.filter((a: any) => a.rsvp === 'going').map((a: any) => profiles[a.user_id]).filter(Boolean);

  return (
    <article className="relative min-h-[500px] md:min-h-[550px] overflow-hidden rounded-[60px] bg-primary text-white p-8 md:p-16 flex flex-col justify-between group cursor-grab active:cursor-grabbing border-4 border-white/5 shadow-2xl mx-1 md:mx-0">
       <div className="absolute inset-0 bg-gradient-to-br from-primary via-[#1a2b3c] to-black z-0" />
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04] pointer-events-none scale-[2.5] logo-royal z-1" style={{ '--logo-url': `url(${alsaifMark.url})` } as any} />
       <div className="absolute -top-40 -right-40 size-[500px] bg-gold-primary/10 rounded-full blur-[100px] pointer-events-none group-hover:scale-110 transition-transform duration-1000" />

       <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-8 w-full">
          <div className="space-y-4">
             <div className="flex items-center gap-3">
                <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest shadow-xl backdrop-blur-md">مناسبة قادمة</span>
                <span className="px-4 py-1.5 rounded-full bg-white/5 text-white/60 border border-white/10 text-[10px] font-black uppercase tracking-widest backdrop-blur-md flex items-center gap-2">
                   <Clock className="size-3" /> {meeting.duration_minutes || "—"} دقيقة
                </span>
             </div>
             <h3 className="text-4xl md:text-7xl font-black tracking-tighter leading-tight drop-shadow-2xl">{meeting.title}</h3>
          </div>

          <div className="flex flex-row md:flex-col md:items-end items-center justify-between md:justify-start w-full md:w-auto gap-4 shrink-0">
             <div className="text-right">
                <span className="text-gold-primary font-black uppercase tracking-[0.4em] text-[10px] mb-1 block">{date.weekday}</span>
                <div className="flex items-baseline gap-2 md:block">
                   <span className="text-5xl md:text-9xl font-black tracking-tighter text-white leading-none block">{date.day}</span>
                   <span className="text-lg md:text-3xl font-black text-white/30 uppercase tracking-widest md:-mt-4 block">{date.month}</span>
                </div>
             </div>
             <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl">
                <Timer className="size-3.5 text-gold-primary animate-pulse" />
                <span className="text-sm font-black text-white">{date.time}</span>
             </div>
          </div>
       </div>

       <div className="relative z-10 flex flex-col md:flex-row items-end justify-between gap-10 w-full mt-10">
          <div className="space-y-8 flex-1 w-full">
             <p className="text-lg md:text-xl font-bold text-white/70 max-w-2xl leading-relaxed border-r-4 border-gold-primary/20 pr-8">{meeting.description || "لا يوجد وصف لهذه المناسبة."}</p>

             <div className="flex flex-wrap items-center gap-6 md:gap-10">
                {meeting.location && (
                  <div className="flex items-center gap-4 group/loc">
                     <div className="size-12 md:size-14 rounded-[20px] md:rounded-[24px] bg-white/5 flex items-center justify-center text-gold-primary border border-white/10 shadow-2xl group-hover/loc:bg-gold-primary group-hover/loc:text-black transition-all duration-500">
                        <MapPin size={24} />
                     </div>
                     <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30">موقع اللقاء</p>
                        {meeting.location_url ? (
                           <a href={meeting.location_url} target="_blank" rel="noreferrer" className="text-base md:text-lg font-black hover:text-gold-primary underline underline-offset-8 decoration-gold-primary/20 transition-all flex items-center gap-2">{meeting.location} <Navigation size={14} className="opacity-40" /></a>
                        ) : (
                           <p className="text-base md:text-lg font-black">{meeting.location}</p>
                        )}
                     </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                   <div className="flex -space-x-4 space-x-reverse">
                      {going.slice(0, 4).map((p: any) => (
                        <div key={p.id} className="size-10 md:size-12 rounded-[15px] md:rounded-[18px] border-4 border-primary overflow-hidden shadow-2xl transition-transform hover:-translate-y-1">
                           <UserAvatar path={p.avatar_url} name={p.arabic_name} className="size-full" userId={p.id} />
                        </div>
                      ))}
                      {going.length > 4 && (
                        <div className="size-10 md:size-12 rounded-[15px] md:rounded-[18px] bg-gold-primary text-black text-[10px] font-black flex items-center justify-center border-4 border-primary shadow-2xl">+{going.length - 4}</div>
                      )}
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/30">المشاركون</p>
                      <p className="text-xs font-black text-white">{counts.going} حاضر مؤكد</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="flex flex-col gap-4 w-full md:w-auto min-w-full md:min-w-[320px]">
             <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-[28px] flex items-center gap-1.5 shadow-2xl">
                <RsvpInteractiveBtn active={myRsvp === 'going'} onClick={() => onRsvp(meeting.id, 'going')} label="سأحضر" color="bg-emerald-500" icon={<UserCheck size={18} />} />
                <RsvpInteractiveBtn active={myRsvp === 'not_going'} onClick={() => onRsvp(meeting.id, 'not_going')} label="أعتذر" color="bg-rose-500" icon={<UserX size={18} />} />
             </div>
             {canManage && (
                <div className="flex items-center gap-2 px-1">
                   <button onClick={() => onEdit(meeting)} className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black flex items-center justify-center gap-2 border border-white/5 uppercase tracking-widest"><Pencil size={12} /> تعديل</button>
                   <button onClick={() => onDelete(meeting.id)} className="flex-1 py-3 rounded-2xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black flex items-center justify-center gap-2 border border-rose-500/10 uppercase tracking-widest"><Trash2 size={12} /> حذف</button>
                </div>
             )}
          </div>
       </div>
    </article>
  );
}

function RsvpInteractiveBtn({ active, onClick, label, color, icon }: any) {
  return (
    <button onClick={onClick} className={cn("flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[22px] text-xs font-black transition-all duration-500", active ? cn(color, "text-white shadow-xl scale-[1.02]") : "text-white/40 hover:text-white hover:bg-white/5")}>
       {icon}
       <span>{label}</span>
    </button>
  );
}
